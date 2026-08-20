const { NotFoundError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
  const { listId } = ctx.params;
  const bandId = ctx.state.bandId; // Припускаємо, що він уже встановлений політикою has-band-access

  // Якщо немає listId — повертаємо 400 або 404
  if (!listId) {
    throw new NotFoundError("No listId provided in the route.");
  }

  // Шукаємо список за його ID.
  //
  // Populate тут заданий ОБ'ЄКТОМ, а не масивом із запиту: динамічну зону
  // `points` треба populate-ити вглиб (компоненти + пісня всередині), а масив
  // цього не виражає. Клієнт нічого не втрачає — усе, що він просив, і так
  // перелічене нижче.
  const list = await strapi.entityService.findOne("api::list.list", listId, {
    populate: {
      band: true,
      // Застаріла реляція; лишається джерелом міграції для препроду й проду.
      songs: true,
      points: { populate: "*" },
    },
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
