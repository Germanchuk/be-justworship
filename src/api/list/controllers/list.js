'use strict';

/**
 * list controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::list.list', ({ strapi }) => ({
  async currentBandLists(ctx) {
    // Get the authenticated user's ID from the request context
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be authenticated to view the lists.');
    }

    // Fetch the user with the 'currentBand' relation populated
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      populate: ['currentBand'], // Populate the 'currentBand' relation
    });

    // Retrieve the currentBand ID from the populated user object
    const currentBandId = user.currentBand?.id;

    if (!currentBandId) {
      return ctx.badRequest('No current band associated with the user.');
    }

    // Ensure ctx.query.filters is always an object
    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      band: currentBandId, // Assuming List has a relation to Band
    };

    // Use the default core action to handle the rest
    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
}));
