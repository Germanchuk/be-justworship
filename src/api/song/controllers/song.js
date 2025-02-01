"use strict";

/**
 * song controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::song.song", ({ strapi }) => ({
  async parseHolychords(ctx) {
    try {
      // @ts-ignore-next-line
      const { data } = ctx.request.body;
      const currentBandId = ctx.state.currentBandId;

      const parsedSong = await strapi
        .service("api::song.1-custom")
        .scrapeHolychords(data.url);

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

   return await strapi.entityService.findMany('api::band.band', {
      filters: { church: currentChurchId },
      // Optionally, populate relations if you need to return related data
      populate: ["songs"],
    });

  },
  async findOneBandSong(ctx) {
    const song = ctx.state.song;
    return { data: song };
  },
  async customCreate(ctx) {
    const currentBandId = ctx.state.currentBandId;
    const songData = ctx.request.body.data;

    const createdSong = await strapi.entityService.create('api::song.song', {
      data: {
        ...songData,
        owner: currentBandId,
      },
    });

    return { data: createdSong };
  },
  async customUpdate(ctx) {
    const song = ctx.state.song;
    const songData = ctx.request.body.data;

    const updatedSong = await strapi.entityService.update('api::song.song', song.id, {
      data: songData,
      populate: ["sections", ...(ctx?.query?.populate ?? [])],
    });

    return { data: updatedSong };
  },
  async customDelete(ctx) {
    const song = ctx.state.song;

    const deletedEntity = await strapi.entityService.delete('api::song.song', song.id);

    return ctx.send({ message: 'Deleted successfully', data: deletedEntity });
  }
}));
