const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { songId } = ctx.params;
  const currentChurchId = ctx.state.currentChurchId; // Припускаємо, що він уже встановлений політикою has-current-church
  const currentBandId = ctx.state.currentBandId;

  // Якщо немає songId — повертаємо 400 або 404
  if (!songId) {
    throw new NotFoundError("No songId provided in the route.");
  }

  // Шукаємо список за його ID
  const song = await strapi.entityService.findOne("api::song.song", songId, {
    populate: [...(ctx.request?.query?.populate ?? []), "owner"]
  });

  const bands = await strapi.entityService.findMany('api::band.band', {
    filters: { church: currentChurchId },
  });
  const bandIds = bands.map(band => band.id);

  // Якщо такої пісні немає, або вона не належить currentChurch, повертаємо 404
  if (!song || !song.owner || !bandIds.includes(song.owner.id)) {
    throw new NotFoundError("Пісня яку ви намагаєтесь отримати не належить вашій церкві.");
  }

  if (song.owner.id !== currentBandId) {
    song.readonly = true;
  }

  // Записуємо знайдений список в ctx.state, щоб у контролері не шукати вдруге
  ctx.state.song = song;

  // Пропускаємо далі
  return true;
};
