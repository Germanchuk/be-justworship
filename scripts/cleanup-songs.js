'use strict';

/**
 * One-off cleanup: наведення ладу в піснях (аналіз 2026-08-15, PROD).
 *
 * Що чинить (порядок важливий):
 *   1. ASSIGN  — 10 пісень без `owner`, кожна лежить у списку рівно одного
 *                гурту → проставляємо owner = той гурт. Це прибирає 404
 *                "Пісня не належить цьому гурту" при відкритті зі списку.
 *   2. COPY    — 6 пісень лежать у списку гурту X, а належать гурту Y.
 *                Створюємо копію з owner = X і перепідключаємо саме ті
 *                списки гурту X. Оригінал у гурті Y лишається недоторканим.
 *   3. REPOINT — пісня-заглушка 86 "-" (гурт «Вова і Акім») у двох списках
 *                гурту «Вова сам». Копію НЕ робимо: у «Вова сам» уже є
 *                власна заглушка 154 "-", друга створила б у бібліотеці два
 *                однакові на вигляд "-". Перепідключаємо списки на 154.
 *   4. DELETE  — 12 пісень: 10 порожніх (нуль тексту, поза списками, без
 *                collab-стану й преференцій) + 7 і 47 (старі версії пісень,
 *                що вже є в «Вова сам» як 196 і 94, поза списками з 2024).
 *   5. PREFS   — дедуплікація `user-song-preference`: лишаємо по одному
 *                запису на пару (user, song) — найсвіжіший за updatedAt;
 *                решту та записи без пісні видаляємо.
 *
 * Безпека:
 *   - DRY-RUN ЗА ЗАМОВЧУВАННЯМ. Пишемо лише з `--apply`.
 *   - Кожен крок перед дією ПЕРЕВІРЯЄ передумови на живих даних і
 *     пропускає пункт, якщо стан не той, що очікувався (скрипт можна
 *     безпечно перезапустити — вже зроблене він просто пропустить).
 *   - Копія створюється явним списком полів. `song_collab_state` НЕ
 *     копіюється навмисно: це oneToOne, і копіювання відв'язало б
 *     Yjs-стан від оригіналу.
 *
 * Використання (з кореня be-justworship):
 *   node scripts/cleanup-songs.js --env-file .env.prod
 *   node scripts/cleanup-songs.js --env-file .env.prod --apply
 *   node scripts/cleanup-songs.js --env-file .env.prod --only prefs
 */

const _envIdx = process.argv.indexOf('--env-file');
if (_envIdx !== -1) {
  require('dotenv').config({ path: process.argv[_envIdx + 1], override: true });
}

const strapiFactory = require('@strapi/strapi');

const apply = process.argv.includes('--apply');
const _onlyIdx = process.argv.indexOf('--only');
const only = _onlyIdx !== -1 ? process.argv[_onlyIdx + 1] : null;
const wants = (step) => !only || only === step;

// ---------------------------------------------------------------------------
// План (зафіксований за аналізом PROD станом на 2026-08-15)
// ---------------------------------------------------------------------------

/** Пісні без owner, що лежать у списку рівно одного гурту. */
const ASSIGN = [
  { song: 16, band: 2 }, // Сила Імені Христа   → Вова і Андрій
  { song: 18, band: 2 }, // Будь благословен    → Вова і Андрій
  { song: 25, band: 2 }, // Голгофський хрест   → Вова і Андрій
  { song: 26, band: 2 }, // Як Він любить нас   → Вова і Андрій
  { song: 29, band: 2 }, // Святий навіки       → Вова і Андрій
  { song: 20, band: 1 }, // Ти Зі Мною          → Інші
  { song: 33, band: 1 }, // Земле, радій!       → Інші
  { song: 40, band: 1 }, // Надія є             → Інші
  { song: 41, band: 1 }, // Лиш тебе            → Інші
  { song: 42, band: 1 }, // Наш Бог всемогутній Бог → Інші
];

/** Пісня в списку чужого гурту → копія для гурту-власника списку. */
const COPY = [
  { song: 17, band: 2 }, // Вірю я (Символ віри)  Вова сам      → Вова і Андрій
  { song: 21, band: 1 }, // Божа Доброта          Вова сам      → Інші
  { song: 30, band: 1 }, // Бог з нами            Різдво 2025   → Інші
  { song: 31, band: 1 }, // Його ім'я - Ісус      Вова сам      → Інші
  { song: 38, band: 2 }, // Ріка благодаті        Інші          → Вова і Андрій
  { song: 44, band: 2 }, // Наш Бог ... у небі    Wednesday     → Вова і Андрій
];

/** Заглушка: списки гурту `band` перемикаємо з `from` на наявну `to`. */
const REPOINT = [{ from: 86, to: 154, band: 3 }];

/** Пісні на видалення. */
const DELETE = [
  7, 47, // старі версії пісень, що вже є в «Вова сам» (196, 94), поза списками
  66, 80, 81, 163, 164, 165, 180, 182, 194, 199, // порожні, нічим не зв'язані
];

// ---------------------------------------------------------------------------
// Допоміжне
// ---------------------------------------------------------------------------

let changes = 0;
let skips = 0;

const act = (msg) => {
  changes++;
  console.log(`  ${apply ? '✔' : '[dry] →'} ${msg}`);
};
const skip = (msg) => {
  skips++;
  console.log(`  ⊘ ПРОПУЩЕНО: ${msg}`);
};

/** Текст пісні без заголовка й мета-рядка — щоб судити про "порожність". */
function bodyText(slate) {
  if (!Array.isArray(slate)) return '';
  const walk = (n) => {
    if (typeof n?.text === 'string') return n.text;
    if (Array.isArray(n?.children)) return n.children.map(walk).join('');
    return '';
  };
  return slate
    .filter((n) => n?.type !== 'song-name' && n?.type !== 'song-meta-row')
    .map(walk)
    .join('')
    .trim();
}

/** Унікальна назва в межах ОДНОГО гурту (виправлена версія uniqueNameGenerator). */
async function uniqueName(app, desired, bandId) {
  let name = desired;
  let counter = 2;
  for (;;) {
    const found = await app.entityService.findMany('api::song.song', {
      filters: { name: { $eq: name }, owner: bandId },
      fields: ['id'],
    });
    if (!found.length) return name;
    name = `${desired} (${counter++})`;
  }
}

/** Списки гурту `bandId`, що містять пісню `songId`, з поточним порядком пісень. */
async function listsOfBandContaining(app, bandId, songId) {
  const lists = await app.entityService.findMany('api::list.list', {
    filters: { band: bandId, songs: { id: songId } },
    populate: { songs: { fields: ['id', 'name'] } },
  });
  return lists;
}

/**
 * Замінює пісню в списку, зберігаючи порядок. Порядок читаємо з линк-таблиці
 * напряму — не покладаємось на те, в якому порядку populate віддає пісні.
 */
async function replaceSongInList(app, listId, fromId, toId) {
  const knex = app.db.connection;
  const rows = await knex('lists_songs_links')
    .select('song_id', 'song_order')
    .where('list_id', listId)
    .orderBy('song_order', 'asc');

  const ordered = rows.map((r) => Number(r.song_id));
  if (!ordered.includes(fromId)) return { ok: false, reason: `пісні ${fromId} немає в списку ${listId}` };
  if (ordered.includes(toId)) return { ok: false, reason: `пісня ${toId} вже є в списку ${listId} — вийшов би дубль` };

  const next = ordered.map((id) => (id === fromId ? toId : id));

  if (apply) {
    await app.entityService.update('api::list.list', listId, { data: { songs: next } });
  }
  return { ok: true, before: ordered, after: next };
}

// ---------------------------------------------------------------------------
// Кроки
// ---------------------------------------------------------------------------

async function stepAssign(app) {
  console.log('\n── 1. ASSIGN: owner для пісень-сиріт ──');
  for (const { song: songId, band: bandId } of ASSIGN) {
    const song = await app.entityService.findOne('api::song.song', songId, { populate: ['owner'] });
    if (!song) { skip(`#${songId} — пісні немає`); continue; }
    if (song.owner) { skip(`#${songId} «${song.name}» — owner уже є (${song.owner.name})`); continue; }

    const inLists = await listsOfBandContaining(app, bandId, songId);
    if (!inLists.length) { skip(`#${songId} «${song.name}» — немає в жодному списку гурту ${bandId}`); continue; }

    if (apply) await app.entityService.update('api::song.song', songId, { data: { owner: bandId } });
    act(`#${songId} «${song.name}» → owner = гурт ${bandId} (у ${inLists.length} його списк.)`);
  }
}

async function stepCopy(app) {
  console.log('\n── 2. COPY: пісня в списку чужого гурту → власна копія ──');
  for (const { song: songId, band: bandId } of COPY) {
    const src = await app.entityService.findOne('api::song.song', songId, {
      populate: ['owner', 'sections'],
    });
    if (!src) { skip(`#${songId} — пісні немає`); continue; }
    if (src.owner?.id === bandId) { skip(`#${songId} «${src.name}» — уже належить гурту ${bandId}`); continue; }

    const lists = await listsOfBandContaining(app, bandId, songId);
    if (!lists.length) { skip(`#${songId} «${src.name}» — немає у списках гурту ${bandId}`); continue; }

    const name = await uniqueName(app, src.name, bandId);

    // Явний список полів. song_collab_state / lastCollabSavedAt / преференції
    // НЕ копіюємо — інакше oneToOne-стан відв'язався б від оригіналу.
    const data = {
      name,
      owner: bandId,
      bpm: src.bpm,
      key: src.key,
      timeSignature: src.timeSignature,
      slate: src.slate,
      sections: (src.sections || []).map(({ id, ...rest }) => rest),
    };

    let newId = '<new>';
    if (apply) {
      const created = await app.entityService.create('api::song.song', { data });
      newId = created.id;
    }
    act(`#${songId} «${src.name}» (гурт ${src.owner?.id}) → копія #${newId} «${name}» у гурт ${bandId}`);

    for (const list of lists) {
      const res = await replaceSongInList(app, list.id, songId, apply ? newId : -1);
      if (!apply) {
        console.log(`      список #${list.id} (${list.date}): позиція пісні ${songId} → копія`);
      } else if (res.ok) {
        console.log(`      ✔ список #${list.id}: ${songId} → ${newId}`);
      } else {
        skip(`список #${list.id}: ${res.reason}`);
      }
    }
  }
}

async function stepRepoint(app) {
  console.log('\n── 3. REPOINT: заглушка "-" на власну заглушку гурту ──');
  for (const { from, to, band } of REPOINT) {
    const [srcSong, dstSong] = await Promise.all([
      app.entityService.findOne('api::song.song', from, { populate: ['owner'] }),
      app.entityService.findOne('api::song.song', to, { populate: ['owner'] }),
    ]);
    if (!srcSong || !dstSong) { skip(`${from}→${to} — однієї з пісень немає`); continue; }
    if (dstSong.owner?.id !== band) { skip(`#${to} не належить гурту ${band}`); continue; }

    const lists = await listsOfBandContaining(app, band, from);
    if (!lists.length) { skip(`#${from} немає у списках гурту ${band}`); continue; }

    for (const list of lists) {
      const res = await replaceSongInList(app, list.id, from, to);
      if (res.ok) act(`список #${list.id} (${list.date}): ${from} «${srcSong.name}» → ${to} «${dstSong.name}»`);
      else skip(`список #${list.id}: ${res.reason}`);
    }
  }
}

async function stepDelete(app) {
  console.log('\n── 4. DELETE: порожні та застарілі дублікати ──');
  for (const songId of DELETE) {
    const song = await app.entityService.findOne('api::song.song', songId, {
      populate: ['owner', 'song_collab_state', 'users_song_preferences'],
    });
    if (!song) { skip(`#${songId} — уже немає`); continue; }

    const knex = app.db.connection;
    const [{ count: listCount }] = await knex('lists_songs_links').where('song_id', songId).count();
    const prefs = song.users_song_preferences?.length ?? 0;
    const body = bodyText(song.slate);
    const keepForContent = ![7, 47].includes(songId) && body.length > 0;

    const blockers = [];
    if (Number(listCount) > 0) blockers.push(`у ${listCount} списк.`);
    if (song.song_collab_state) blockers.push('має collab-стан');
    if (prefs > 0) blockers.push(`${prefs} преференц.`);
    if (keepForContent) blockers.push(`має текст (${body.length} симв.)`);

    if (blockers.length) { skip(`#${songId} «${song.name}» — ${blockers.join(', ')}`); continue; }

    if (apply) await app.entityService.delete('api::song.song', songId);
    act(`видалено #${songId} «${song.name}» (гурт ${song.owner?.name ?? '—'}, тіло ${body.length} симв.)`);
  }
}

async function stepPrefs(app) {
  console.log('\n── 5. PREFS: дедуплікація преференцій ──');
  const all = await app.entityService.findMany('api::user-song-preference.user-song-preference', {
    populate: { user: { fields: ['id'] }, song: { fields: ['id'] } },
    limit: -1,
  });

  const orphans = all.filter((p) => !p.song || !p.user);
  const groups = new Map();
  for (const p of all) {
    if (!p.song || !p.user) continue;
    const key = `${p.user.id}:${p.song.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const doomed = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => {
      const t = new Date(b.updatedAt) - new Date(a.updatedAt);
      return t !== 0 ? t : b.id - a.id;
    });
    const [keep, ...rest] = rows;
    console.log(
      `  ${key}: ${rows.length} записів → лишаємо #${keep.id} (transposition=${keep.transposition},` +
        ` updatedAt=${new Date(keep.updatedAt).toISOString().slice(0, 10)}), видаляємо ${rest.length}`,
    );
    doomed.push(...rest);
  }

  for (const p of orphans) {
    if (apply) await app.entityService.delete('api::user-song-preference.user-song-preference', p.id);
    act(`сирота-преференція #${p.id} (song=${p.song?.id ?? 'null'}, user=${p.user?.id ?? 'null'})`);
  }
  for (const p of doomed) {
    if (apply) await app.entityService.delete('api::user-song-preference.user-song-preference', p.id);
    changes++;
  }
  if (doomed.length) {
    console.log(`  ${apply ? '✔' : '[dry] →'} видалено ${doomed.length} дублікатів преференцій`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\n=== cleanup-songs — ${apply ? 'APPLY (запис у БД)' : 'DRY-RUN (нічого не пишемо)'} ===`,
  );
  console.log(`DB: ${process.env.DATABASE_NAME} @ ${process.env.DATABASE_HOST}`);
  if (only) console.log(`--only ${only}`);

  const app = await strapiFactory().load();

  if (wants('assign')) await stepAssign(app);
  if (wants('copy')) await stepCopy(app);
  if (wants('repoint')) await stepRepoint(app);
  if (wants('delete')) await stepDelete(app);
  if (wants('prefs')) await stepPrefs(app);

  console.log(
    `\n=== ${apply ? 'ЗАСТОСОВАНО' : 'DRY-RUN'}: ${changes} змін, ${skips} пропущено ===\n`,
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
