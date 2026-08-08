const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { listId } = ctx.params;
  const bandId = ctx.state.bandId; // Припускаємо, що він уже встановлений політикою has-band-access

  // Якщо немає listId — повертаємо 400 або 404
  if (!listId) {
    throw new NotFoundError("No listId provided in the route.");
  }

  // Шукаємо список за його ID
  const list = await strapi.entityService.findOne("api::list.list", listId, {
    populate: [...(ctx.request?.query?.populate ?? []), "band", "songs"], // Можна коротше, якщо треба лише band
  });

  // Якщо такого списку немає, або він не належить гурту з URL, повертаємо 404
  if (!list || !list.band || list.band.id !== bandId) {
    throw new NotFoundError("List not found for this band.");
  }

  // Записуємо знайдений список в ctx.state, щоб у контролері не шукати вдруге
  ctx.state.list = list;

  // Пропускаємо далі
  return true;
};
