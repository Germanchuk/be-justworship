"use strict";

/**
 * song controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const generateUniqueName = require("../utils/uniqueNameGenerator");

module.exports = createCoreController("api::song.song", ({ strapi }) => ({
  async parseHolychords(ctx) {
    try {
      // @ts-ignore-next-line
      const { data } = ctx.request.body;
      const currentBandId = ctx.state.currentBandId;

      const parsedSong = await strapi
        .service("api::song.1-custom")
        .scrapeHolychords(data.url);

      console.log("parsedSong", parsedSong);

      return await strapi.entityService.create("api::song.song", {
        data: {
          ...parsedSong,
          owner: currentBandId
        },
      });

    } catch (e) {
      console.log(e);
    }
  },
  async currentBandSongs(ctx) {
    const currentBandId = ctx.state.currentBandId;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      owner: currentBandId,
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  async currentChurchSongs(ctx) {
    const currentChurchId = ctx.state.currentChurchId;
    const filters = ctx.query.filters || {};

    filters.church  = currentChurchId;

    // Отримуємо всі гурти, пов'язані з поточною церквою
    const bands = await strapi.entityService.findMany('api::band.band', {
      filters,
    });

    // За допомогою Promise.all виконуємо паралельний запит для кожного гурту, щоб отримати пісні
    return Promise.all(
      bands.map(async (band) => {
        const songs = await strapi.entityService.findMany('api::song.song', {
          filters: {
            ...filters,
            owner: band.id,
          },
        });
        return { ...band, songs };
      })
    );
  },
  async findOneBandSong(ctx) {
    const song = ctx.state.song;

    return { data: song };
  },
  async customCreate(ctx) {
    const currentBandId = ctx.state.currentBandId;
    const songData = ctx.request.body.data;

    const name = await generateUniqueName(songData.name, ctx, strapi);

    const createdSong = await strapi.entityService.create('api::song.song', {
      data: {
        ...songData,
        owner: currentBandId,
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
    const currentBandId = ctx.state.currentBandId;


    const originalSong = await strapi.entityService.findOne('api::song.song', song.id, {
      populate: '*',
    });

    const name = await generateUniqueName(originalSong.name, ctx, strapi);

    // Видаляємо поля, які автоматично створюються або мають бути унікальними
    const { id: originalId, createdAt, updatedAt, updatedBy, createdBy, users_song_preferences, publishedAt, ...songData } = originalSong;

    // Створюємо нову пісню з отриманими даними
    const newSong = await strapi.entityService.create('api::song.song', {
      data: {
        ...songData,
        owner: currentBandId,
        name
      },
    });

    // Повертаємо копію пісні у відповіді
    return {
      data: newSong
    };
  },
}));
