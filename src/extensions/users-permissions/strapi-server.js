module.exports = (plugin) => {
    plugin.controllers.user.updateMe = async (ctx) => {
      try {
        // Get the current authenticated user from the token
        const user = ctx.state.user;
  
        if (!user) {
          return ctx.badRequest('You must be authenticated to update your profile.');
        }
  
        // Get the data to update from the request body
        const updateData = ctx.request.body;
  
        // Define the fields that the user is allowed to update (for security)
        const allowedFields = ['username', 'email', 'currentBand']; // Customize as needed
  
        // Filter out only the fields that are allowed to be updated
        const filteredData = Object.keys(updateData)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updateData[key];
            return obj;
          }, {});
  
        if (Object.keys(filteredData).length === 0) {
          return ctx.badRequest('No valid fields to update.');
        }
  
        // Update the user in the database
        const updatedUser = await strapi.entityService.update(
          'plugin::users-permissions.user', user.id, {
            data: filteredData,
          }
        );
  
        // Return the updated user data
        return ctx.send(updatedUser);
  
      } catch (err) {
        return ctx.badRequest('An error occurred while updating the user.', err);
      }
    };
  
    return plugin;
  };
  