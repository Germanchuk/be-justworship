const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { songId } = ctx.params;
  const currentBandId = ctx.state.currentBandId; // Припускаємо, що він уже встановлений політикою has-current-band

  // Якщо немає songId — повертаємо 400 або 404
  if (!songId) {
    throw new NotFoundError("No songId provided in the route.");
  }

  // Шукаємо список за його ID
  const song = await strapi.entityService.findOne("api::song.song", songId, {
    populate: [...(ctx.request?.query?.populate ?? []), "owner"]
  });

  // Якщо такого списку немає, або він не належить currentBand, повертаємо 404
  if (!song || !song.owner || song.owner.id !== currentBandId) {
    throw new NotFoundError("Пісня яку ви намагаєтесь отримати не належить вашому гурту.");
  }

  // Записуємо знайдений список в ctx.state, щоб у контролері не шукати вдруге
  ctx.state.song = song;

  // Пропускаємо далі
  return true;
};
