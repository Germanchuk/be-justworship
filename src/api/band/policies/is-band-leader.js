'use strict';

const { ForbiddenError } = require('@strapi/utils').errors;

const { ROLE_POPULATE, roleOf, BAND_ROLES } = require('../utils/roles');

/**
 * Перша дія, справді закрита роллю: видалити гурт може лише його лідер.
 *
 * Очікує `ctx.state.bandId` від `global::has-band-access` — тобто те, що юзер
 * узагалі учасник цього гурту, вже перевірено вище.
 *
 * Гурт без лідера (заведений до появи ролей) видалити не може НІХТО: `roleOf`
 * поверне для всіх `member`. Лідера таким гуртам проставляє
 * `scripts/backfill-band-leaders.js`.
 */
module.exports = async (ctx, config, { strapi }) => {
  const band = await strapi.entityService.findOne(
    'api::band.band',
    ctx.state.bandId,
    { populate: ROLE_POPULATE }
  );

  if (roleOf(band, ctx.state.user.id) !== BAND_ROLES.LEADER) {
    throw new ForbiddenError('Видалити гурт може лише його лідер.');
  }

  return true;
};
