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
  async updateMyCurrentBandList(ctx) {
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be authenticated to update the list.');
    }

    // Fetch the user with the 'currentBand' relation
    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId,
      {
        populate: ['currentBand'],
      }
    );

    const currentBandId = user.currentBand?.id;

    if (!currentBandId) {
      return ctx.badRequest('No current band associated with the user.');
    }

    // Extract the list ID from the request params
    const { id: listId } = ctx.params;

    // Attempt to find the list that belongs to the current band
    const existingList = await strapi.entityService.findOne(
      'api::list.list',
      listId,
      {
        filters: {
          band: currentBandId,
        },
      }
    );

    if (!existingList) {
      return ctx.notFound('List not found for the current band.');
    }

    // Perform the update
    const updatedList = await strapi.entityService.update(
      'api::list.list',
      listId,
      {
        data: ctx.request.body.data,
      }
    );

    return { data: updatedList };
  },
}));
