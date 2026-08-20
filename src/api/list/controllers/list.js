'use strict';

/**
 * list controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  ACTIVE_BAND_FILTER,
  findActiveBandIdsOf,
} = require('../../band/utils/soft-delete');
const { POINT_POPULATE, SONG_POINT, readPoints } = require('../utils/points');

/**
 * Список без дати не має сенсу: і на головному, і на сторінці гурту він
 * показується саме датою — без неї рядок нічим не назвати. У схемі `date`
 * лишається необов'язковою свідомо: в базі вже є старі списки без дати, і
 * `required` заблокував би будь-яке їх редагування. Тому вимогу тримаємо тут.
 */
const MISSING_DATE = 'Оберіть дату служіння.';

/**
 * Підпис служіння («Недільне служіння», «Молодіжне»). Порожній підпис —
 * нормальний стан: клієнт показує в такому разі текст за замовчуванням, тож
 * тут стежимо лише за довжиною, щоб у рядок не заганяли простирадло.
 */
const TITLE_MAX_LENGTH = 60;
const TITLE_TOO_LONG = `Підпис служіння — не довший за ${TITLE_MAX_LENGTH} символів.`;

/** `null`, якщо все гаразд; інакше — готовий текст помилки. */
const titleError = (listData) => {
  const title = listData?.title;
  if (typeof title === 'string' && title.trim().length > TITLE_MAX_LENGTH) {
    return TITLE_TOO_LONG;
  }
  return null;
};

// Валідації пунктів тут немає свідомо: типи, обов'язковість і довжину
// перевіряє схема компонентів (`src/components/list/`). Дублювати її руками
// означало б мати два описи одного правила.

module.exports = createCoreController('api::list.list', ({ strapi }) => ({
  async bandLists(ctx) {
    const bandId = ctx.state.bandId;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      band: bandId,
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  // Custom action to gather lists from user's bands
  async findMyLists(ctx) {
    const bandIds = await findActiveBandIdsOf(strapi, ctx.state.user?.id);

    if (bandIds.length === 0) {
      return {
        data: [],
        meta: { pagination: { total: 0, page: 1, pageSize: 25, pageCount: 0 } },
      };
    }

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      band: { $in: bandIds },
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  async currentChurchLists(ctx) {
    const currentChurchId = ctx.state.currentChurchId;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      band: { church: currentChurchId, ...ACTIVE_BAND_FILTER },
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  async findOneBandList(ctx) {
    const list = ctx.state.list;
    // Пункти рахуються на віддачі, а не зберігаються двічі: старий список
    // виводить їх зі своєї реляції, новий — бере збережені, і обидва проходять
    // звірку з реляцією, щоб видалена пісня не лишалась у порядку привидом.
    return { data: { ...list, points: readPoints(list) } };
  },
  /**
   * Усе служіння одним запитом: пункти списку плюс ВМІСТ кожної пісні.
   *
   * Чому вміст береться зі `slateFull`, а не з `song.slate`: публічна колонка
   * навмисне знеособлена (`sanitizeSnapshot` у collab-сервісі вирізає з неї
   * капо, згорнуті секції, фільтри показу й примітки). Саме ці налаштування
   * гурт і хоче бачити на зібранні — «як налаштували на репетиції». Тому
   * джерело тут — повна копія документа, яку collab тримає поруч зі своїм
   * станом.
   *
   * Свіжість: `slateFull` пишеться при збереженні collab-документа, тобто
   * відстає від живої правки щонайбільше на її дебаунс. Для служіння цього
   * досить — зібрання свідомо показує знімок, а не редагується наживо.
   *
   * Пісня, яку ще жодного разу не відкривали в новому редакторі, свого
   * collab-стану не має — для неї лишається `song.slate`.
   */
  async gathering(ctx) {
    const list = ctx.state.list;
    const points = readPoints(list);

    const songIds = points
      .filter((point) => point.__component === SONG_POINT)
      .map((point) => point.song.id);

    const contentBySong = new Map();

    if (songIds.length > 0) {
      const states = await strapi.entityService.findMany(
        'api::song-collab-state.song-collab-state',
        {
          filters: { song: { id: { $in: songIds } } },
          fields: ['id', 'slateFull'],
          populate: { song: { fields: ['id'] } },
          limit: -1,
        }
      );

      for (const state of states) {
        if (state.song && Array.isArray(state.slateFull)) {
          contentBySong.set(String(state.song.id), state.slateFull);
        }
      }

      // Фолбек для немігрованих пісень — по одній, лише для тих, кого бракує.
      const missing = songIds.filter((id) => !contentBySong.has(String(id)));
      if (missing.length > 0) {
        const songs = await strapi.entityService.findMany('api::song.song', {
          filters: { id: { $in: missing } },
          fields: ['id', 'slate'],
          limit: -1,
        });
        for (const song of songs) {
          if (Array.isArray(song.slate)) {
            contentBySong.set(String(song.id), song.slate);
          }
        }
      }
    }

    return {
      data: {
        id: list.id,
        date: list.date,
        title: list.title,
        points: points.map((point) =>
          point.__component === SONG_POINT
            ? { ...point, slate: contentBySong.get(String(point.song.id)) ?? null }
            : point
        ),
      },
    };
  },

  async customCreate(ctx) {
    const bandId = ctx.state.bandId;
    const listData = ctx.request.body.data;

    if (!listData?.date) {
      return ctx.badRequest(MISSING_DATE);
    }

    const badTitle = titleError(listData);
    if (badTitle) {
      return ctx.badRequest(badTitle);
    }

    const createdList = await strapi.entityService.create('api::list.list', {
      data: {
        ...listData,
        band: bandId,
      },
      populate: POINT_POPULATE,
    });

    return { data: { ...createdList, points: readPoints(createdList) } };
  },
  async customUpdate(ctx) {
    const list = ctx.state.list;
    const listData = ctx.request.body.data;

    // Перевіряємо лише те, що прийшло: частковий апдейт без поля `date`
    // дату не чіпає, а от порожня дата в тілі — це саме те стирання, яке
    // ми й забороняємо.
    if ('date' in (listData ?? {}) && !listData.date) {
      return ctx.badRequest(MISSING_DATE);
    }

    const badTitle = titleError(listData);
    if (badTitle) {
      return ctx.badRequest(badTitle);
    }

    const updatedList = await strapi.entityService.update('api::list.list', list.id, {
      data: listData,
      populate: POINT_POPULATE,
    });

    return { data: { ...updatedList, points: readPoints(updatedList) } };
  },
  async customDelete(ctx) {
    const list = ctx.state.list;

    const deletedEntity = await strapi.entityService.delete('api::list.list', list.id);

    return ctx.send({ message: 'Deleted successfully', data: deletedEntity });
  }
}));
