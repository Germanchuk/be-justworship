module.exports = async (desiredName, ctx, strapi) => {

  let newName = desiredName;
  let counter = 2;
  const currentBandId = ctx.state.currentBandId;

  // Шукаємо записи з поточним newName
  let songs = await strapi.entityService.findMany("api::song.song", {
    filters: {
      name: { $eq: newName },
      owner: currentBandId,
    }
  });

  // Поки знайдено записи з таким ім'ям - додаємо суфікс
  while (songs.length) {
    newName = `${desiredName} (${counter})`;
    counter++;

    // Перевірка нового імені
    songs = await strapi.entityService.findMany("api::song.song", {
      filters: {
        name: { $eq: newName },
      }
    });
  }

  return newName;
};
