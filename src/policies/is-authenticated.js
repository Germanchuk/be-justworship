const { UnauthorizedError } = require("@strapi/utils").errors;
module.exports = async (ctx, config, { strapi }) => {
    if (!ctx.state.user) {
      throw new UnauthorizedError("You must be authenticated to perform this action.");
    }

    return true;
  };