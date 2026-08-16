"use strict";

/**
 * song controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const generateUniqueName = require("../utils/uniqueNameGenerator");
const {
  ACTIVE_BAND_FILTER,
  findActiveBandsOf,
} = require("../../band/utils/soft-delete");

module.exports = createCoreController("api::song.song", ({ strapi }) => ({
  async parseHolychords(ctx) {
    try {
      // @ts-ignore-next-line
      const { data } = ctx.request.body;
      const bandId = ctx.state.bandId;

      const parsedSong = await strapi
        .service("api::song.1-custom")
        .scrapeHolychords(data.url);

      console.log("parsedSong", parsedSong);

      return await strapi.entityService.create("api::song.song", {
        data: {
          ...parsedSong,
          owner: bandId
        },
      });

    } catch (e) {
      console.log(e);
    }
  },
  async bandSongs(ctx) {
    const bandId = ctx.state.bandId;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      owner: bandId,
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  // Пошук пісні по всіх гуртах юзера, згрупований по гуртах: однойменні пісні
  // в різних гуртах — різні пісні, тож зливати їх в один список не можна.
  async searchMySongs(ctx) {
    const query = String(ctx.query.q ?? '').trim();

    // Порожній запит не шукаємо: інакше віддали б усі пісні всіх гуртів.
    if (!query) {
      return { data: [] };
    }

    const bands = await findActiveBandsOf(strapi, ctx.state.user.id);

    if (bands.length === 0) {
      return { data: [] };
    }

    const songs = await strapi.entityService.findMany('api::song.song', {
      filters: {
        owner: { id: { $in: bands.map((band) => band.id) } },
        name: { $containsi: query },
      },
      fields: ['id', 'name'],
      populate: { owner: { fields: ['id'] } },
      sort: { name: 'asc' },
      // Стеля на випадок запиту в одну літеру — екран усе одно стільки не
      // покаже, а тягнути всю бібліотеку немає сенсу.
      limit: 100,
    });

    // Групи заводимо наперед, у порядку назв гуртів: так порядок секцій
    // не стрибає від запиту до запиту.
    const groups = new Map(
      [...bands]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        .map((band) => [band.id, { band: { id: band.id, name: band.name }, songs: [] }])
    );

    songs.forEach((song) => {
      groups.get(song.owner?.id)?.songs.push({ id: song.id, name: song.name });
    });

    return {
      data: [...groups.values()].filter((group) => group.songs.length > 0),
    };
  },
  async currentChurchSongs(ctx) {
    const currentChurchId = ctx.state.currentChurchId;
    const { name: songNameFilter, ...bandFilters } = ctx.query.filters || {};

    bandFilters.church = currentChurchId;

    // Отримуємо всі гурти, пов'язані з поточною церквою
    const bands = await strapi.entityService.findMany('api::band.band', {
      filters: { ...bandFilters, ...ACTIVE_BAND_FILTER },
    });

    // За допомогою Promise.all виконуємо паралельний запит для кожного гурту, щоб отримати пісні
    const results = await Promise.all(
      bands.map(async (band) => {
        const songs = await strapi.entityService.findMany('api::song.song', {
          filters: {
            owner: band.id,
            ...(songNameFilter ? { name: songNameFilter } : {}),
          },
        });
        return { ...band, songs };
      })
    );

    // При пошуку приховуємо гурти, в яких немає пісень, що відповідають запиту
    return songNameFilter ? results.filter((band) => band.songs.length > 0) : results;
  },
  async findOneBandSong(ctx) {
    const song = ctx.state.song;

    return { data: song };
  },
  async customCreate(ctx) {
    const bandId = ctx.state.bandId;
    const songData = ctx.request.body.data;

    const name = await generateUniqueName(songData.name, ctx, strapi);

    const createdSong = await strapi.entityService.create('api::song.song', {
      data: {
        ...songData,
        owner: bandId,
        name
      },
    });

    return { data: createdSong };
  },
  async customUpdate(ctx) {
    const song = ctx.state.song;
    const songData = ctx.request.body.data;

    const updatedSong = await strapi.entityService.update('api::song.song', song.id, {
      data: {
        ...songData
      },
      populate: ["sections", ...(ctx?.query?.populate ?? [])],
    });

    return { data: updatedSong };
  },
  async customDelete(ctx) {
    const song = ctx.state.song;

    const deletedEntity = await strapi.entityService.delete('api::song.song', song.id);

    return ctx.send({ message: 'Deleted successfully', data: deletedEntity });
  },
  async copySong(ctx) {
    const song = ctx.state.song;
    const bandId = ctx.state.bandId;


    const originalSong = await strapi.entityService.findOne('api::song.song', song.id, {
      populate: '*',
    });

    const name = await generateUniqueName(originalSong.name, ctx, strapi);

    // Видаляємо поля, які автоматично створюються або мають бути унікальними
    const { id: originalId, createdAt, updatedAt, updatedBy, createdBy, publishedAt, ...songData } = originalSong;

    // Створюємо нову пісню з отриманими даними
    const newSong = await strapi.entityService.create('api::song.song', {
      data: {
        ...songData,
        owner: bandId,
        name
      },
    });

    // Повертаємо копію пісні у відповіді
    return {
      data: newSong
    };
  },
}));
