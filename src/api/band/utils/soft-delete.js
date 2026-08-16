'use strict';

/**
 * М'яке видалення гурту.
 *
 * Гурт не зникає з бази — йому проставляється `deletedAt`. Для користувача
 * він щезає звідусіль: зі списку гуртів, з пошуку, з пошуку пісень, з доступу
 * до сторінок. Дані (пісні, списки, collab-стан) лишаються цілими, тож
 * відновлення — це очистити одне поле.
 *
 * НАВІЩО ЄДИНИЙ ХЕЛПЕР: місць, які читають «гурти юзера», ~7, і кожне
 * пропущене — це діра, крізь яку видалений гурт лізе назад. Тому ніде не
 * populate-имо `user.bands` руками: усі питають `findActiveBandsOf`.
 *
 * ЖОРСТКЕ ВИДАЛЕННЯ ще не реалізоване (свідомо). Коли з'явиться, воно має
 * знайти гурти з простроченим `deletedAt` і видалити ЯВНИМ каскадом у порядку:
 * `song_collab_states` → `songs` → `lists` → `bands`. У Strapi каскадяться лише
 * link-таблиці, самі рядки — ні, тож наївний `delete('api::band.band')`
 * лишить сиріт (те, що розгрібали 2026-08-15).
 */

/** Фільтр «гурт живий» для будь-якого запиту по `api::band.band`. */
const ACTIVE_BAND_FILTER = { deletedAt: { $null: true } };

/**
 * Живі гурти юзера. Свідомо окремим запитом, а не `populate: ['bands']`:
 * у populate легко забути витягти `deletedAt` — і тоді фільтр мовчки
 * пропустить усе.
 */
async function findActiveBandsOf(strapi, userId, fields = ['id', 'name']) {
  return strapi.entityService.findMany('api::band.band', {
    filters: { users: { id: userId }, ...ACTIVE_BAND_FILTER },
    fields,
    limit: -1,
  });
}

/** Те саме, але одразу id — найчастіший випадок. */
async function findActiveBandIdsOf(strapi, userId) {
  const bands = await findActiveBandsOf(strapi, userId, ['id']);
  return bands.map((band) => band.id);
}

module.exports = {
  ACTIVE_BAND_FILTER,
  findActiveBandsOf,
  findActiveBandIdsOf,
};
