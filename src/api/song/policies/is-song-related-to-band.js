const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { songId } = ctx.params;
  const bandId = ctx.state.bandId; // Припускаємо, що він уже встановлений політикою has-band-access

  // Якщо немає songId — повертаємо 400 або 404
  if (!songId) {
    throw new NotFoundError("No songId provided in the route.");
  }

  // Шукаємо пісню за її ID
  const song = await strapi.entityService.findOne("api::song.song", songId, {
    populate: [...(ctx.request?.query?.populate ?? []), "owner"]
  });

  // Якщо такої пісні немає, або вона не належить гурту з URL, повертаємо 404
  if (!song || !song.owner || song.owner.id !== bandId) {
    throw new NotFoundError("Пісня яку ви намагаєтесь отримати не належить цьому гурту.");
  }

  // Записуємо знайдену пісню в ctx.state, щоб у контролері не шукати вдруге
  ctx.state.song = song;

  // Пропускаємо далі
  return true;
};
