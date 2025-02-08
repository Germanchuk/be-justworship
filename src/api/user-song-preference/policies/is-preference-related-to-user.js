const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { preferenceId } = ctx.params;
  const userId = ctx.state.user?.id;

  // Якщо немає preferenceId — повертаємо 400 або 404
  if (!preferenceId) {
    throw new NotFoundError("No preferenceId provided in the route.");
  }

  let preference = await strapi.entityService.findOne("api::user-song-preference.user-song-preference", preferenceId, {
    populate: [...(ctx.request?.query?.populate ?? []), "user"]
  });

  // Якщо такого списку немає, або він не належить currentBand, повертаємо 404
  if (!preference || !preference.user || preference?.user?.id !== userId) {
    throw new NotFoundError("Преференси які ви намагаєтесь отримати не належать вам.");
  }

  ctx.state.preference = preference;

  // Пропускаємо далі
  return true;
};
