'use strict';

/**
 * One-off: проставити лідера гуртам, заведеним ДО появи ролей (2026-08-16).
 *
 * Навіщо: видалити гурт може лише лідер (`api::band.is-band-leader`). У старих
 * гуртів `leader` порожній, тож видалити їх не може ніхто — навіть той, хто
 * гурт замовляв. Скрипт закриває саме цю дірку.
 *
 * Кого призначає: учасника з НАЙМЕНШИМ id — на практиці це той, хто в гурті
 * найдовше. Евристика, тож дивись dry-run очима: якщо для якогось гурту вона
 * не та, признач вручну парою `--band <id> --user <id>`.
 *
 * Гурти, у яких лідер уже є, скрипт не чіпає — перезапускати безпечно.
 * Порожні гурти (без учасників) пропускає: призначати нікого.
 *
 * Використання (з кореня be-justworship):
 *   node scripts/backfill-band-leaders.js --env-file .env.prod
 *   node scripts/backfill-band-leaders.js --env-file .env.prod --apply
 *   node scripts/backfill-band-leaders.js --env-file .env.prod --band 3 --user 7 --apply
 */

const _envIdx = process.argv.indexOf('--env-file');
if (_envIdx !== -1) {
  require('dotenv').config({ path: process.argv[_envIdx + 1], override: true });
}

const strapiFactory = require('@strapi/strapi');

const apply = process.argv.includes('--apply');

const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? Number(process.argv[index + 1]) : null;
};

const onlyBand = argValue('--band');
const forcedUser = argValue('--user');

let changes = 0;
let skips = 0;

async function main() {
  console.log(
    `\n=== backfill-band-leaders — ${
      apply ? 'APPLY (запис у БД)' : 'DRY-RUN (нічого не пишемо)'
    } ===`
  );
  console.log(`DB: ${process.env.DATABASE_NAME} @ ${process.env.DATABASE_HOST}`);

  const app = await strapiFactory().load();

  const bands = await app.entityService.findMany('api::band.band', {
    filters: onlyBand ? { id: onlyBand } : {},
    populate: {
      leader: { fields: ['id'] },
      users: { fields: ['id', 'username'] },
    },
    limit: -1,
  });

  for (const band of bands) {
    const label = `гурт ${band.id} "${band.name}"`;

    if (band.leader) {
      console.log(`SKIP  ${label}: лідер уже є (user ${band.leader.id})`);
      skips += 1;
      continue;
    }

    const members = band.users ?? [];
    if (members.length === 0) {
      console.log(`SKIP  ${label}: жодного учасника, призначати нікого`);
      skips += 1;
      continue;
    }

    let leader;
    if (forcedUser != null) {
      leader = members.find((user) => user.id === forcedUser);
      if (!leader) {
        console.log(
          `SKIP  ${label}: user ${forcedUser} не є учасником цього гурту`
        );
        skips += 1;
        continue;
      }
    } else {
      leader = [...members].sort((a, b) => a.id - b.id)[0];
    }

    console.log(
      `SET   ${label}: лідер → ${leader.username} (user ${leader.id})` +
        ` [учасників: ${members.length}]`
    );

    if (apply) {
      await app.entityService.update('api::band.band', band.id, {
        data: { leader: leader.id },
      });
    }
    changes += 1;
  }

  console.log(
    `\n=== ${apply ? 'ЗАСТОСОВАНО' : 'DRY-RUN'}: ${changes} змін, ${skips} пропущено ===\n`
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
