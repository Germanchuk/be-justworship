'use strict';

const { UnauthorizedError } = require('@strapi/utils').errors;

module.exports = (ctx, config, { strapi }) => {
  const expected = process.env.COLLAB_SERVICE_TOKEN;

  if (!expected) {
    strapi.log.error('COLLAB_SERVICE_TOKEN env variable is not set');
    throw new UnauthorizedError('Collab service is not configured');
  }

  const provided = ctx.request.header['x-collab-token'];

  if (!provided || provided !== expected) {
    throw new UnauthorizedError('Invalid collab service token');
  }

  return true;
};
