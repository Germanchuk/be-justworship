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

      const result = await strapi
        .service("api::song.1-custom")
        .scrapeHolychords(data.url);

      return await strapi.entityService.create("api::song.song", {
        data: result,
      });

    } catch (e) {
      console.log(e);
    }
  },
}));
