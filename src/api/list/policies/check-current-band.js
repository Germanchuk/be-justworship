const { PolicyError } = require("@strapi/utils").errors;

module.exports = async (ctx, config, { strapi }) => {
  const user = ctx.state.user;

  const populatedUser = await strapi.entityService.findOne(
    "plugin::users-permissions.user",
    user.id,
    { populate: ["currentBand"] }
  );

  if (!populatedUser?.currentBand) {
    throw new PolicyError("No current band associated with the user.");
  }

  ctx.state.currentBandId = populatedUser.currentBand.id;

  return true;
};
