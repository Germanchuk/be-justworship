const { PolicyError, ForbiddenError } = require("@strapi/utils").errors;

const { findActiveBandIdsOf } = require("../api/band/utils/soft-delete");

/**
 * Гурт більше не зберігається в юзері — він приходить з URL (`/bands/:bandId/...`).
 * Ця політика перевіряє, що юзер справді учасник цього гурту, і кладе в ctx.state:
 *  - `bandId`      — гурт, у контексті якого працює запит;
 *  - `userBandIds` — усі гурти юзера (потрібні там, де запит зачіпає сусідній гурт,
 *                    наприклад копіювання пісні між своїми гуртами).
 *
 * Видалені гурти сюди не потрапляють: це головний шлюз до всього band-scoped,
 * тож саме тут м'яке видалення й починає діяти. Повторне видалення теж
 * відсікається тут — гурт із `deletedAt` уже недоступний власному лідеру.
 */
module.exports = async (ctx, config, { strapi }) => {
  const { bandId } = ctx.params;

  if (!bandId) {
    throw new PolicyError("No bandId provided in the route.");
  }

  const userBandIds = await findActiveBandIdsOf(strapi, ctx.state.user.id);

  if (!userBandIds.some((id) => String(id) === String(bandId))) {
    throw new ForbiddenError("Ви не є учасником цього гурту.");
  }

  ctx.state.bandId = Number(bandId);
  ctx.state.userBandIds = userBandIds;

  return true;
};
