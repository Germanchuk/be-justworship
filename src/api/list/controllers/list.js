'use strict';

/**
 * list controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::list.list', ({ strapi }) => ({
  // Override the default 'find' action
  async find(ctx) {
    // Get the authenticated user from the request context
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view the lists.');
    }

    // Retrieve the currentBand ID from the user
    const currentBandId = user.currentBand?.id;

    if (!currentBandId) {
      return ctx.badRequest('No current band associated with the user.');
    }

    // Modify the query to filter lists by the currentBand relation
    // Ensure ctx.query.filters is always an object
    const {
        filters
      } = ctx.query;
    ctx.query.filters = {
        ...(filters || {}), // Ensure existing filters are preserved
        band: currentBandId, // Assuming List has a relation to Band
      };

    // Use the default core action to handle the rest
    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
}));
