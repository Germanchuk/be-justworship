'use strict';

/**
 * band controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::band.band', ({ strapi }) => ({
  // Sets (or clears) the band's designated playback device. Band-scoped:
  // operates on the caller's current band (resolved by has-current-band).
  async setPlayerDevice(ctx) {
    const currentBandId = ctx.state.currentBandId;
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const playerDeviceId = body.playerDeviceId ?? null;
    const playerDeviceName = body.playerDeviceName ?? null;

    const updated = await strapi.entityService.update('api::band.band', currentBandId, {
      data: { playerDeviceId, playerDeviceName },
    });

    return { data: updated };
  },
}));
