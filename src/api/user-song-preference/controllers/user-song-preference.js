'use strict';

/**
 * user-song-preference controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-song-preference.user-song-preference', ({strapi}) => ({
  async getPreferencesBySongId(ctx) {
    const user = ctx.state.user;
    const songId = ctx.params.songId;

    const preferences = await strapi.entityService.findMany('api::user-song-preference.user-song-preference', {
      filters: {
        song: songId,
        user: user.id
      }
    });

    return {
      data: preferences?.[0]
    }
  },
  savePreference: async (ctx) => {
    const preference = ctx.state.preference;
    const { createdAt, updatedAt, id ,...preferenceData } = ctx.request.body;

    const updatedPreference = await strapi.entityService.update('api::user-song-preference.user-song-preference', preference.id, {
      data: {
        ...preferenceData
      },
      populate: [...(ctx?.query?.populate ?? [])],
    });

    return { data: updatedPreference };
  },
  createPreference: async (ctx) => {
    const userId = ctx.state.user?.id;
    const preferenceData = ctx.request.body;
    const songId = ctx.params.songId;

    const createdPreference = await strapi.entityService.create('api::user-song-preference.user-song-preference', {
      data: {
        ...preferenceData,
        user: userId,
        song: songId
      }
    });

    return {
      data: createdPreference
    }
  }
}));
