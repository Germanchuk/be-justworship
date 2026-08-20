'use strict';

/**
 * Переїзд списків на пункти: з реляції `songs` у динамічну зону `points`.
 *
 * Що робить: кожному списку, у якого зона ще порожня, створює послідовність
 * пісенних пунктів (`list.song-point`) у тому ж порядку, у якому пісні лежать
 * у реляції.
 *
 * Чого НЕ робить: не чіпає саму реляцію `songs`. Вона лишається джерелом цієї
 * міграції для решти середовищ — прибирається зі схеми окремо, коли переїдуть
 * усі.
 *
 * Списки, у яких пункти вже є, скрипт не чіпає — перезапускати безпечно.
 * Порожні списки пропускає: переносити нема чого, перший же запис із
 * застосунку заповнить їх сам.
 *
 * ⚠️ ПЕРЕД ДЕПЛОЄМ СХЕМИ В СЕРЕДОВИЩЕ, ДЕ ВЖЕ Є ПУНКТИ-НЕ-ПІСНІ: примітки й
 * програші в реляції не відображені, тож відновити їх цей скрипт не може.
 * Спершу переконайся, що таких пунктів там немає (або вивантаж їх окремо).
 *
 * ⚠️ БАЗА ЗА ЗАМОВЧУВАННЯМ — НЕ ЛОКАЛЬНА. `be-justworship/.env` вказує на
 * preprod (див. `README.local.md`). Локальні значення накладає
 * `local/with-env.sh`, і саме через нього треба ходити, коли ціль локальна.
 *
 * Використання (з кореня репозиторію):
 *   make list-points          # локально, dry-run
 *   make list-points-apply    # локально, запис
 *
 * Не локально — запис вимагає явного `--remote`:
 *   cd be-justworship && node scripts/backfill-list-points.js               # preprod, dry-run
 *   cd be-justworship && node scripts/backfill-list-points.js --apply --remote
 *   cd be-justworship && node scripts/backfill-list-points.js --env-file .env.prod --apply --remote
 */

const _envIdx = process.argv.indexOf('--env-file');
if (_envIdx !== -1) {
  require('dotenv').config({ path: process.argv[_envIdx + 1], override: true });
}

const strapiFactory = require('@strapi/strapi');

const apply = process.argv.includes('--apply');

/**
 * Запобіжник від того, на чому я вже спіткнувся: цілив у докер, а `.env`
 * мовчки привів у preprod. Рядок `DB:` нижче про це казав, але на нього можна
 * не подивитись — тож віддалена база тепер вимагає сказати це вголос.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const isLocalDb = LOCAL_HOSTS.has(process.env.DATABASE_HOST);
const remoteConfirmed = process.argv.includes('--remote');

let migrated = 0;
let skipped = 0;
let empty = 0;

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

  const app = await strapiFactory().load();

  const lists = await app.entityService.findMany('api::list.list', {
    populate: {
      songs: { fields: ['id', 'name'] },
      points: { populate: '*' },
    },
    limit: -1,
  });

  for (const list of lists) {
    const label = `список ${list.id} (${list.date ?? 'без дати'}${
      list.title ? `, "${list.title}"` : ''
    })`;

    if (Array.isArray(list.points) && list.points.length > 0) {
      console.log(`SKIP  ${label}: пункти вже є (${list.points.length})`);
      skipped += 1;
      continue;
    }

    const songs = list.songs ?? [];
    if (songs.length === 0) {
      console.log(`EMPTY ${label}: жодної пісні, переносити нема чого`);
      empty += 1;
      continue;
    }

    const points = songs.map((song) => ({
      __component: 'list.song-point',
      song: song.id,
    }));

    console.log(
      `SET   ${label}: ${points.length} пунктів ← ${songs
        .map((s) => s.name || `#${s.id}`)
        .join(' · ')}`
    );

    if (apply) {
      // Свідомо лише `points`: реляція `songs` лишається як була.
      await app.entityService.update('api::list.list', list.id, {
        data: { points },
      });
    }
    migrated += 1;
  }

  console.log(
    `\n=== ${apply ? 'ЗАСТОСОВАНО' : 'DRY-RUN'}: ${migrated} перенесено, ` +
      `${skipped} уже мали пункти, ${empty} порожніх ===\n`
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
