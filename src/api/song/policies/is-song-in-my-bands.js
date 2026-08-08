const { NotFoundError } = require("@strapi/utils").errors;

/**
 * Пісня-джерело для копіювання: має належати будь-якому з гуртів юзера,
 * не обовʼязково тому, що в URL. Так лишається можливість перенести пісню
 * з одного свого гурту в інший.
 *
 * Очікує `ctx.state.userBandIds` від `global::has-band-access`.
 */
module.exports = async (ctx, config, { strapi }) => {
  const { songId } = ctx.params;

  if (!songId) {
    throw new NotFoundError("No songId provided in the route.");
  }

  const song = await strapi.entityService.findOne("api::song.song", songId, {
    populate: [...(ctx.request?.query?.populate ?? []), "owner"],
  });

  const userBandIds = ctx.state.userBandIds ?? [];

  if (!song || !song.owner || !userBandIds.includes(song.owner.id)) {
    throw new NotFoundError("Пісня яку ви намагаєтесь отримати не належить вашим гуртам.");
  }

  ctx.state.song = song;

  return true;
};
