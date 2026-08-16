const { findActiveBandIdsOf } = require("../../api/band/utils/soft-delete");

module.exports = (plugin) => {
    // `/users/me?populate=bands` — це те, з чого фронт будує список гуртів і
    // чим гейтить band-роути. Видалений гурт має зникнути і звідси, інакше
    // застосунок далі пускав би в нього (сервер уже відмовляє, але виглядало б
    // це як зламаний екран, а не як видалений гурт).
    const originalMe = plugin.controllers.user.me;

    plugin.controllers.user.me = async (ctx) => {
      await originalMe(ctx);

      if (!Array.isArray(ctx.body?.bands) || ctx.body.bands.length === 0) {
        return;
      }

      // Фільтруємо за списком живих id, а не за полем `deletedAt` у відповіді:
      // populate може приїхати з обмеженим набором полів, і тоді перевірка
      // поля мовчки пропускала б усе.
      const activeIds = new Set(
        (await findActiveBandIdsOf(strapi, ctx.state.user.id)).map(String)
      );

      ctx.body.bands = ctx.body.bands.filter((band) =>
        activeIds.has(String(band.id))
      );
    };

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
        const allowedFields = ['username', 'email']; // Customize as needed
  
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

    plugin.routes['content-api'].routes.push({
        method: "PUT",
        path: "/users/me",
        handler: "user.updateMe"
    })
  
    return plugin;
  };
  