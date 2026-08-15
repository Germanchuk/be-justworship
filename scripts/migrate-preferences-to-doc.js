'use strict';

/**
 * One-off міграція: `user-song-preference` → документ пісні.
 *
 * ⚠️ ІСТОРІЯ: виконано на PROD 2026-08-15 (37 пісень), після чого модель
 * `user-song-preference` видалено з коду. Скрипт більше не запускається —
 * лишається як запис про те, що і як переїхало. Дамп таблиці перед
 * видаленням: `backups/user-song-preferences-final.json`.
 *
 * Стара модель (окрема таблиця на пару user×song) переїжджає в per-user поля
 * самого документа — туди, звідки їх читає редактор:
 *
 *   transposition → song-meta-row › capo.valuesBy[username]
 *   hideChords    → song-meta-row.chordsHiddenFor: [username]
 *   hideLyrics    → song-meta-row.lyricsHiddenFor: [username]
 *
 * Знак не міняється: і старе `transposition`, і нове капо означають «показ на
 * N півтонів НИЖЧЕ» (обидва рахуються через `keyUtils.transpose`).
 *
 * ЯК саме пишемо (джерело правди документа — Yjs-стан, а не JSON):
 *   A. Пісня БЕЗ `song_collab_state` — її ще жодного разу не відкривали в
 *      Slate. Правимо `song.slate`; при першому відкритті `onLoadDocument`
 *      побачить готовий хедер і візьме документ as-is (`bootstrapFromSlate`).
 *   B. Пісня ЗІ станом — штатний шлях відновлення зі `slateBridge.ts`:
 *      повний документ (`slateFull`, а якщо його ще нема — `song.slate`)
 *      кладемо в `song.slate` і ВИДАЛЯЄМО рядок `song_collab_state`. Пісня
 *      забутстрапиться з нього наново вже з капо.
 *
 * ⚠️ Кроку B не можна робити, поки хтось сидить у пісні: живий документ у
 * пам'яті collab-сервера перезапише БД при наступному збереженні. Роби, коли
 * у застосунку нікого, і перезапусти collab після.
 *
 * ⚠️ Побічний ефект кроку B (описаний у `slateBridge.ts`): доки collab не
 * пересейвить пісню, у публічній колонці `song.slate` лежить несанітанізований
 * документ — з примітками й чужими per-user полями. Лікується відкриттям
 * пісні (перше ж збереження кладе туди санітанізовану проєкцію).
 *
 * Безпека:
 *   - DRY-RUN за замовчуванням, пишемо лише з `--apply`;
 *   - ідемпотентно: якщо значення вже стоїть у документі — пропускаємо,
 *     наявне значення нової моделі ніколи не перезаписуємо;
 *   - пісню без хедера пропускаємо з попередженням, а не добудовуємо наосліп;
 *   - перед першим записом усе, що будемо чіпати (стара `song.slate` і ПОВНИЙ
 *     рядок `song_collab_state` разом з base64-станом Yjs), лягає у
 *     `backups/prefs-migration-<timestamp>.json`. Видалення стану інакше
 *     незворотне.
 *
 * Використання (з кореня be-justworship):
 *   node scripts/migrate-preferences-to-doc.js --env-file .env.prod
 *   node scripts/migrate-preferences-to-doc.js --env-file .env.prod --apply
 */

const _envIdx = process.argv.indexOf('--env-file');
if (_envIdx !== -1) {
  require('dotenv').config({ path: process.argv[_envIdx + 1], override: true });
}

const fs = require('fs');
const path = require('path');
const strapiFactory = require('@strapi/strapi');

const apply = process.argv.includes('--apply');
const backup = [];
const plan = [];

const PREF_UID = 'api::user-song-preference.user-song-preference';
const SONG_UID = 'api::song.song';
const STATE_UID = 'api::song-collab-state.song-collab-state';

let changed = 0;
let skipped = 0;
let warned = 0;

const isMeaningful = (p) =>
  (p.transposition ?? 0) !== 0 || !!p.hideChords || !!p.hideLyrics;

/** [song-name, song-meta-row, …] — інакше документ не наш. */
function metaRowOf(doc) {
  if (!Array.isArray(doc) || doc.length < 2) return null;
  if (doc[0]?.type !== 'song-name' || doc[1]?.type !== 'song-meta-row') return null;
  return doc[1];
}

/**
 * Вписати преференції одного користувача в документ. Мутує `doc` на місці,
 * повертає список того, що реально змінилось (порожній = нічого).
 */
function applyPref(doc, username, pref) {
  const row = metaRowOf(doc);
  if (!row) return null; // сигнал «немає хедера»

  const done = [];

  const t = pref.transposition ?? 0;
  if (t !== 0) {
    let capo = (row.children || []).find((c) => c?.type === 'capo');
    if (!capo) {
      capo = { type: 'capo', valuesBy: {}, children: [{ text: '' }] };
      row.children = [...(row.children || []), capo];
      done.push('створено capo-елемент');
    }
    capo.valuesBy = capo.valuesBy || {};
    const current = capo.valuesBy[username] ?? 0;
    if (current === 0) {
      capo.valuesBy[username] = t;
      done.push(`capo[${username}]=${t}`);
    }
  }

  for (const [flag, field] of [
    ['hideChords', 'chordsHiddenFor'],
    ['hideLyrics', 'lyricsHiddenFor'],
  ]) {
    if (!pref[flag]) continue;
    const list = row[field] || [];
    if (!list.includes(username)) {
      row[field] = [...list, username];
      done.push(`${field} += ${username}`);
    }
  }

  return done;
}

async function main() {
  console.log(
    `\n=== migrate-preferences-to-doc — ${apply ? 'APPLY (запис у БД)' : 'DRY-RUN (нічого не пишемо)'} ===`,
  );
  console.log(`DB: ${process.env.DATABASE_NAME} @ ${process.env.DATABASE_HOST}\n`);

  const app = await strapiFactory().load();

  const prefs = await app.entityService.findMany(PREF_UID, {
    populate: ['user', 'song'],
    limit: -1,
  });

  // Групуємо по пісні: одна пісня — один запис у БД, скільки б юзерів її не
  // налаштували (song 174 має преференції двох).
  const bySong = new Map();
  for (const p of prefs) {
    if (!isMeaningful(p)) continue;
    if (!p.song || !p.user?.username) {
      console.log(`  ⚠ преференція #${p.id}: немає пісні або юзера — пропуск`);
      warned++;
      continue;
    }
    if (!bySong.has(p.song.id)) bySong.set(p.song.id, []);
    bySong.get(p.song.id).push(p);
  }

  console.log(`Пісень до міграції: ${bySong.size}\n`);

  for (const [songId, songPrefs] of bySong) {
    const song = await app.entityService.findOne(SONG_UID, songId, {
      fields: ['id', 'name', 'slate'],
    });
    if (!song) {
      console.log(`  ⚠ song ${songId}: немає в БД — пропуск`);
      warned++;
      continue;
    }

    const states = await app.entityService.findMany(STATE_UID, {
      filters: { song: { id: songId } },
      fields: ['id', 'slateFull', 'version', 'state'],
      limit: 1,
    });
    const state = states[0] || null;

    // Джерело документа. Зі станом беремо ПОВНУ проєкцію (`slateFull`), щоб не
    // згубити примітки й чужі per-user поля; якщо її ще нема (старі рядки до
    // появи колонки) — лишається `song.slate`, і тоді разом з ним у документі
    // лишається рівно те, що там і було: такі пісні мають version=1, тобто
    // після бутстрапу їх не правили.
    const source = state
      ? Array.isArray(state.slateFull)
        ? 'slateFull'
        : 'song.slate (slateFull відсутній)'
      : 'song.slate';
    const doc = JSON.parse(
      JSON.stringify(state && Array.isArray(state.slateFull) ? state.slateFull : song.slate),
    );

    const label = `song ${songId} «${song.name}»`;

    if (!metaRowOf(doc)) {
      console.log(`  ⚠ ${label}: документ без хедера (${source}) — пропуск, треба руками`);
      warned++;
      continue;
    }

    const done = [];
    for (const p of songPrefs) {
      const res = applyPref(doc, p.user.username, p);
      if (res && res.length) done.push(...res);
    }

    if (done.length === 0) {
      skipped++;
      continue; // усе вже стоїть у документі
    }

    const mode = state ? `B: ${source} → song.slate + видалити стан (v${state.version})` : 'A: правка song.slate';
    console.log(`  ${apply ? '✔' : '[dry] →'} ${label}`);
    console.log(`        ${mode}`);
    console.log(`        ${done.join('; ')}`);

    backup.push({
      songId,
      songName: song.name,
      slateBefore: song.slate,
      collabStateBefore: state, // разом з base64 `state` — те, що видаляємо
    });
    plan.push({ songId, doc, stateId: state?.id ?? null });
    changed++;
  }

  // Бекап пишемо ДО першого запису: видалення `song_collab_state` інакше
  // незворотне (у ньому єдина копія Yjs-стану).
  if (apply && backup.length) {
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(
      dir,
      `prefs-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nБекап (${backup.length} пісень): ${file}`);
  }

  if (apply) {
    for (const item of plan) {
      await app.entityService.update(SONG_UID, item.songId, { data: { slate: item.doc } });
      if (item.stateId) await app.entityService.delete(STATE_UID, item.stateId);
    }
  }

  console.log(
    `\n=== ${apply ? 'ЗАСТОСОВАНО' : 'DRY-RUN'}: змінено ${changed} пісень, пропущено ${skipped} (уже в документі), попереджень ${warned} ===\n`,
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
