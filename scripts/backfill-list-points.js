'use strict';

/**
 * Переїзд списків на пункти (тікет `02`).
 *
 * Два проходи, обидва ідемпотентні — перезапускати безпечно:
 *
 *   1. РЕЛЯЦІЯ → ЗОНА. Списку з порожньою зоною створюється послідовність
 *      пісенних пунктів (`list.song-point`) у тому ж порядку, у якому пісні
 *      лежать у застарілій реляції `songs`. Це вся міграція препроду й проду:
 *      типізованих пунктів там немає жодного.
 *
 *   2. ПРОГРАШ → ПРИМІТКА, ЩО ЗВУЧИТЬ. Пункт старого зразка
 *      (`list.interlude-point`) стає приміткою з ознакою `sounding`. Зона
 *      такого списку переписується цілком, бо пункт не має тотожності поза
 *      своїм місцем у порядку — саме так її пише й клієнт.
 *
 * Чого скрипт НЕ робить: не чіпає саму реляцію `songs` і не знімає компонент
 * програша зі схеми. І те, і те — окремий крок ПІСЛЯ того, як переїхали всі
 * три середовища: реляція і є джерелом цієї міграції, зняти її раніше означає
 * дропнути списки, що не переїхали.
 *
 * ─── ПОРЯДОК, ЯКИЙ НЕ МОЖНА ПЕРЕСТАВИТИ ────────────────────────────────────
 * У середовищі спершу ДЕПЛОЙ бекенда з пунктами, і лише потім цей скрипт.
 * Причина не в зручності: `forceMigration` у Strapi ввімкнений за
 * замовчуванням, тож застосунок, чия схема не знає про пункти, при старті
 * ЗНЕСЕ таблиці зони — а вони саме те, що ми щойно наповнили. Скрипт піднімає
 * Strapi з ЛОКАЛЬНОГО коду, тож без деплою він створить у віддаленій базі
 * схему, яку розгорнутий застосунок потім видалить разом з даними.
 *
 * Тому для віддаленої бази нижче стоїть перевірка: немає таблиць зони —
 * значить бекенд там ще старий, і скрипт не запускається.
 *
 * ⚠️ БАЗА ЗА ЗАМОВЧУВАННЯМ — НЕ ЛОКАЛЬНА. `be-justworship/.env` вказує на
 * препрод (див. `README.local.md`), і саме він читається, коли `--env-file`
 * не заданий. Локальні значення накладає `local/with-env.sh`, і саме через
 * нього треба ходити, коли ціль локальна.
 *
 * Використання (з кореня репозиторію):
 *   make list-points          # локально, dry-run
 *   make list-points-apply    # локально, запис
 *
 * Не локально — запис вимагає явного `--remote`:
 *   cd be-justworship && node scripts/backfill-list-points.js               # препрод, dry-run
 *   cd be-justworship && node scripts/backfill-list-points.js --apply --remote
 *   cd be-justworship && node scripts/backfill-list-points.js --env-file .env.prod --apply --remote
 */

/**
 * Env читаємо САМІ й одразу. Strapi прочитав би `.env` теж, але значно
 * пізніше — а нам треба знати ціль ДО того, як щось робити: і рядок `DB:`, і
 * обидві перевірки нижче стоять перед підйомом застосунку.
 */
require('dotenv').config();
const _envIdx = process.argv.indexOf('--env-file');
if (_envIdx !== -1) {
  require('dotenv').config({ path: process.argv[_envIdx + 1], override: true });
}

const strapiFactory = require('@strapi/strapi');

const apply = process.argv.includes('--apply');

const SONG_POINT = 'list.song-point';
const NOTE_POINT = 'list.note-point';
/** Старий окремий компонент програша. Читається, але вже не пишеться. */
const INTERLUDE_POINT = 'list.interlude-point';

/**
 * Той самий текст, що й `SOUNDING_NOTE_TEXT` у клієнті
 * (`pwa-justworship/src/models/listPoint.ts`). Старий програш свого підпису не
 * мав — поле `custom` не вміла писати жодна версія застосунку, — тож підпис
 * тут не переноситься, а призначається.
 */
const SOUNDING_NOTE_TEXT = 'Програш';

/**
 * Таблиця, за якою видно, що бекенд у цьому середовищі вже знає про пункти.
 * Її створює сам Strapi при деплої схеми з динамічною зоною.
 */
const ZONE_TABLE = 'components_list_song_points';

/**
 * Запобіжник від того, на чому я вже спіткнувся: цілив у докер, а `.env`
 * мовчки привів у чужу базу. Рядок `DB:` нижче про це казав, але на нього
 * можна не подивитись — тож не-локальна база вимагає сказати це вголос.
 *
 * По одному лише хосту локальність не визначається: на `127.0.0.1` може
 * слухати й чужа база (той самий brew-постгрес на 5432). Тому «локальна» —
 * це саме докер з `local/local.env`: петльовий хост І імʼя `justworship`.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DOCKER_DB_NAME = 'justworship';
const isLocalDb =
  LOCAL_HOSTS.has(process.env.DATABASE_HOST) &&
  process.env.DATABASE_NAME === DOCKER_DB_NAME;
const remoteConfirmed = process.argv.includes('--remote');

let migrated = 0;
let skipped = 0;
let empty = 0;
let converted = 0;

/**
 * Чи розгорнутий у цій базі бекенд, що знає про пункти.
 *
 * Питаємо ДО того, як підняти Strapi: піднятий Strapi створить ці таблиці сам
 * і відповідь стане завжди «так» — а разом з нею й пастка, заради якої
 * перевірка існує.
 */
async function zoneTableExists() {
  const knex = require('knex')({
    client: 'pg',
    connection: {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT ?? 5432),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'false' ? false : true,
    },
  });
  try {
    return await knex.schema.hasTable(ZONE_TABLE);
  } finally {
    await knex.destroy();
  }
}

/** Пункт із бази → форма, якою зона пишеться назад. `null` — пункт зникає. */
const toWriteForm = (point) => {
  switch (point.__component) {
    case SONG_POINT:
      // Пісню видалили з бібліотеки — реляція занулилась. Такий пункт і так
      // не доїжджає до клієнта (`readPoints`), тож у порядок його не вертаємо.
      return point.song ? { __component: SONG_POINT, song: point.song.id } : null;
    case NOTE_POINT: {
      // Текст став обов'язковим (`minLength: 1`), а в базі могли лишитись
      // порожні примітки з часів, коли не був. Порожній рядок завалив би
      // збереження всього списку — і показувати на служінні його нема за що.
      const text = (point.text ?? '').trim();
      return text ? { __component: NOTE_POINT, text, sounding: Boolean(point.sounding) } : null;
    }
    case INTERLUDE_POINT:
      return { __component: NOTE_POINT, text: SOUNDING_NOTE_TEXT, sounding: true };
    default:
      return null;
  }
};

const labelOf = (list) =>
  `список ${list.id} (${list.date ?? 'без дати'}${list.title ? `, "${list.title}"` : ''})`;

/** Прохід 1: порожня зона ← пісні з реляції. */
async function fillFromRelation(app, list) {
  const songs = list.songs ?? [];
  if (songs.length === 0) {
    console.log(`EMPTY ${labelOf(list)}: жодної пісні, переносити нема чого`);
    empty += 1;
    return;
  }

  const points = songs.map((song) => ({ __component: SONG_POINT, song: song.id }));

  console.log(
    `SET   ${labelOf(list)}: ${points.length} пунктів ← ${songs
      .map((s) => s.name || `#${s.id}`)
      .join(' · ')}`
  );

  if (apply) {
    // Свідомо лише `points`: реляція `songs` лишається як була.
    await app.entityService.update('api::list.list', list.id, { data: { points } });
  }
  migrated += 1;
}

/** Прохід 2: програші старого зразка ← примітки, що звучать. */
async function convertInterludes(app, list) {
  const points = list.points;
  const legacy = points.filter((point) => point.__component === INTERLUDE_POINT).length;

  if (legacy === 0) {
    skipped += 1;
    return;
  }

  const rewritten = points.map(toWriteForm).filter(Boolean);
  const dropped = points.length - rewritten.length;

  console.log(
    `CONV  ${labelOf(list)}: ${legacy} програш(і) → примітка зі «звучить»` +
      (dropped > 0 ? `, ${dropped} порожніх пунктів прибрано` : '')
  );

  if (apply) {
    await app.entityService.update('api::list.list', list.id, { data: { points: rewritten } });
  }
  converted += 1;
}

async function main() {
  console.log(
    `\n=== backfill-list-points — ${
      apply ? 'APPLY (запис у БД)' : 'DRY-RUN (нічого не пишемо)'
    } ===`
  );
  console.log(
    `DB: ${process.env.DATABASE_NAME} @ ${process.env.DATABASE_HOST}` +
      (isLocalDb ? ' (локальна)' : '  ⚠️  ВІДДАЛЕНА')
  );

  if (apply && !isLocalDb && !remoteConfirmed) {
    console.error(
      `\nВІДМОВА: запис у віддалену базу без --remote.\n` +
        `Якщо ціль локальна — ходи через: make list-points-apply\n` +
        `Якщо справді треба сюди — додай --remote.\n`
    );
    process.exit(1);
  }

  if (!isLocalDb && !(await zoneTableExists())) {
    console.error(
      `\nВІДМОВА: у цій базі немає таблиці "${ZONE_TABLE}" — отже бекенд тут\n` +
        `ще не знає про пункти.\n\n` +
        `Спершу задеплой бекенд із динамічною зоною в це середовище, і лише\n` +
        `потім запускай міграцію. Інакше Strapi з локального коду створить\n` +
        `схему сам, а розгорнутий (старий) застосунок при наступному старті\n` +
        `знесе її разом із перенесеними даними: forceMigration увімкнений.\n`
    );
    process.exit(1);
  }

  const app = await strapiFactory().load();

  const lists = await app.entityService.findMany('api::list.list', {
    populate: {
      songs: { fields: ['id', 'name'] },
      points: { populate: '*' },
    },
    limit: -1,
  });

  for (const list of lists) {
    const points = Array.isArray(list.points) ? list.points : [];

    if (points.length === 0) {
      await fillFromRelation(app, list);
    } else {
      await convertInterludes(app, list);
    }
  }

  console.log(
    `\n=== ${apply ? 'ЗАСТОСОВАНО' : 'DRY-RUN'}: ${migrated} перенесено з реляції, ` +
      `${converted} з програшем старого зразка, ${skipped} уже в новій формі, ` +
      `${empty} порожніх ===\n`
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
