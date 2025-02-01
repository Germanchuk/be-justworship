'use strict';

/**
 * list controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::list.list', ({ strapi }) => ({
  async currentBandLists(ctx) {
    const currentBandId = ctx.state.currentBandId;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      band: currentBandId,
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  // Custom action to gather lists from user's bands
  async findMyLists(ctx) {
    // Get the authenticated user's ID
    const userId = ctx.state.user?.id;

    // Fetch the user with their associated bands
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      populate: ['bands'],  // Populate the 'bands' relation
    });

    // Check if the user has bands
    if (!user.bands || user.bands.length === 0) {
      return ctx.badRequest('User is not associated with any bands.');
    }

    // Collect all lists from user's bands
    const bandIds = user.bands.map(band => band.id); // Extract band IDs

    ctx.query.filters = {
        ...(ctx.query.filters || {}),
        band: { $in: bandIds }
      };

    // Query the List content type for all lists related to these band IDs
    const lists = await strapi.entityService.findMany('api::list.list', ctx.query);

    return { data: lists };
  },
  async findOneBandList(ctx) {
    const list = ctx.state.list;
    return { data: list };
  },
  async customCreate(ctx) {
    const currentBandId = ctx.state.currentBandId;
    const listData = ctx.request.body.data;

    const createdList = await strapi.entityService.create('api::list.list', {
      data: {
        ...listData,
        band: currentBandId,
      },
    });

    return { data: createdList };
  },
  async customUpdate(ctx) {
    const list = ctx.state.list;
    const listData = ctx.request.body.data;

    const updatedList = await strapi.entityService.update('api::list.list', list.id, {
      data: listData,
      populate: "songs"
    });

    return { data: updatedList };
  },
  async customDelete(ctx) {
    const list = ctx.state.list;

    const deletedEntity = await strapi.entityService.delete('api::list.list', list.id);

    return ctx.send({ message: 'Deleted successfully', data: deletedEntity });
  }
}));
