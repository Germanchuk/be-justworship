'use strict';

/**
 * band controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::band.band', ({ strapi }) => ({
  // Головний екран — усі гурти юзера з коротким прев'ю, щоб список читався
  // як список чатів: свіжіша активність вгорі, під назвою — останнє служіння.
  async myBands(ctx) {
    const populatedUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      ctx.state.user.id,
      { populate: { bands: { fields: ['id', 'name'] } } }
    );

    const bands = populatedUser?.bands ?? [];

    const data = await Promise.all(
      bands.map(async (band) => {
        const [songsCount, listsCount, lastLists] = await Promise.all([
          strapi.entityService.count('api::song.song', {
            filters: { owner: band.id },
          }),
          strapi.entityService.count('api::list.list', {
            filters: { band: band.id },
          }),
          strapi.entityService.findMany('api::list.list', {
            filters: { band: band.id },
            sort: { date: 'desc' },
            fields: ['id', 'date'],
            limit: 1,
          }),
        ]);

        const lastList = lastLists?.[0]
          ? { id: lastLists[0].id, date: lastLists[0].date }
          : null;

        return { id: band.id, name: band.name, songsCount, listsCount, lastList };
      })
    );

    // Гурти без служінь падають у кінець, решта — за датою останнього служіння.
    data.sort((a, b) => {
      const aDate = a.lastList?.date ?? '';
      const bDate = b.lastList?.date ?? '';
      if (aDate === bDate) return (a.name ?? '').localeCompare(b.name ?? '');
      return bDate.localeCompare(aDate);
    });

    return { data };
  },

  // Sets (or clears) the band's designated playback device. Band-scoped:
  // operates on the band from the URL (resolved by has-band-access).
  async setPlayerDevice(ctx) {
    const bandId = ctx.state.bandId;
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const playerDeviceId = body.playerDeviceId ?? null;
    const playerDeviceName = body.playerDeviceName ?? null;

    const updated = await strapi.entityService.update('api::band.band', bandId, {
      data: { playerDeviceId, playerDeviceName },
    });

    return { data: updated };
  },

  // Склад гурту — лише id + нік. Потрібен фронту, щоб дати вибір,
  // чиї примітки я зараз бачу й редагую (режим приміток). Свідомо не віддаємо
  // нічого зайвого: примітки адресуються по `username`.
  async bandMembers(ctx) {
    const band = await strapi.entityService.findOne(
      'api::band.band',
      ctx.state.bandId,
      { populate: { users: { fields: ['id', 'username'] } } }
    );

    const members = (band?.users ?? [])
      .map(({ id, username }) => ({ id, username }))
      .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));

    return { data: members };
  },
}));
