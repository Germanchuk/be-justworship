const { PolicyError, ForbiddenError } = require("@strapi/utils").errors;

/**
 * Гурт більше не зберігається в юзері — він приходить з URL (`/bands/:bandId/...`).
 * Ця політика перевіряє, що юзер справді учасник цього гурту, і кладе в ctx.state:
 *  - `bandId`      — гурт, у контексті якого працює запит;
 *  - `userBandIds` — усі гурти юзера (потрібні там, де запит зачіпає сусідній гурт,
 *                    наприклад копіювання пісні між своїми гуртами).
 */
module.exports = async (ctx, config, { strapi }) => {
  const { bandId } = ctx.params;

  if (!bandId) {
    throw new PolicyError("No bandId provided in the route.");
  }

  const populatedUser = await strapi.entityService.findOne(
    "plugin::users-permissions.user",
    ctx.state.user.id,
    { populate: ["bands"] }
  );

  const userBandIds = (populatedUser?.bands ?? []).map((band) => band.id);

  if (!userBandIds.some((id) => String(id) === String(bandId))) {
    throw new ForbiddenError("Ви не є учасником цього гурту.");
  }

  ctx.state.bandId = Number(bandId);
  ctx.state.userBandIds = userBandIds;

  return true;
};
