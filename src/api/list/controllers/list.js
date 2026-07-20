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
    const userId = ctx.state.user?.id;

    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      populate: ['bands'],
    });

    const bandIds = (user?.bands || []).map((band) => band.id);

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
      band: { church: currentChurchId },
    };

    const { data, meta } = await super.find(ctx);

    return { data, meta };
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
