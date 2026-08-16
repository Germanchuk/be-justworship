'use strict';

/**
 * band controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { BAND_ROLES, ROLE_POPULATE, roleOf } = require('../utils/roles');
const {
  ACTIVE_BAND_FILTER,
  findActiveBandsOf,
} = require('../utils/soft-delete');

const NAME_MAX_LENGTH = 60;

module.exports = createCoreController('api::band.band', ({ strapi }) => ({
  // Пошук гуртів (екран «Приєднатись до гурту»). Перекриваємо core-find лише
  // заради одного: видалені гурти не мають знаходитись.
  async find(ctx) {
    ctx.query.filters = { ...(ctx.query.filters || {}), ...ACTIVE_BAND_FILTER };

    return super.find(ctx);
  },

  // Для користувача це «видалити гурт», у базі — архівація: проставляємо
  // `deletedAt`, і гурт зникає звідусіль (див. `utils/soft-delete.js`). Пісні,
  // списки й collab-стан не чіпаємо — саме це робить видалення оборотним.
  // Відновлення поки лише руками: очистити `deletedAt`.
  async archiveBand(ctx) {
    const updated = await strapi.entityService.update(
      'api::band.band',
      ctx.state.bandId,
      { data: { deletedAt: new Date() } }
    );

    return { data: { id: updated.id, deletedAt: updated.deletedAt } };
  },

  // Створення гурту. Автор одразу стає і учасником (`users` — це склад, з
  // якого читають усі перевірки доступу), і лідером гурту.
  async createBand(ctx) {
    const userId = ctx.state.user.id;
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return ctx.badRequest('Вкажіть назву гурту.');
    }
    if (name.length > NAME_MAX_LENGTH) {
      return ctx.badRequest(`Назва гурту — не довша за ${NAME_MAX_LENGTH} символів.`);
    }

    const band = await strapi.entityService.create('api::band.band', {
      data: { name, users: [userId], leader: userId },
    });

    // Фронту досить id та назви: далі він перечитує /users/me й іде в гурт.
    return { data: { id: band.id, name: band.name, role: BAND_ROLES.LEADER } };
  },

  // Головний екран — усі гурти юзера з коротким прев'ю, щоб список читався
  // як список чатів: свіжіша активність вгорі, під назвою — останнє служіння.
  async myBands(ctx) {
    const bands = await findActiveBandsOf(strapi, ctx.state.user.id);

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

  // Призначає (або знімає, userId=null) хоста звуку гурту — акаунт, чий
  // пристрій грає фон на всіх (планшет за пультом). Це durable-пам'ять
  // призначення; чи хост зараз онлайн — вирішує awareness band-кімнати.
  async setAudioHost(ctx) {
    const bandId = ctx.state.bandId;
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const userId = body.userId ?? null;

    if (userId != null) {
      const band = await strapi.entityService.findOne('api::band.band', bandId, {
        populate: { users: { fields: ['id'] } },
      });
      const isMember = (band?.users ?? []).some((user) => user.id === Number(userId));
      if (!isMember) {
        return ctx.badRequest('audioHost must be a member of the band');
      }
    }

    const updated = await strapi.entityService.update('api::band.band', bandId, {
      data: { audioHostUserId: userId == null ? null : Number(userId) },
    });

    return { data: { id: updated.id, audioHostUserId: updated.audioHostUserId ?? null } };
  },

  // Склад гурту — id, нік і роль. Потрібен фронту, щоб дати вибір,
  // чиї примітки я зараз бачу й редагую (режим приміток). Свідомо не віддаємо
  // нічого зайвого: примітки адресуються по `username`.
  async bandMembers(ctx) {
    const band = await strapi.entityService.findOne(
      'api::band.band',
      ctx.state.bandId,
      { populate: { users: { fields: ['id', 'username'] }, ...ROLE_POPULATE } }
    );

    const members = (band?.users ?? [])
      .map(({ id, username }) => ({ id, username, role: roleOf(band, id) }))
      .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));

    return { data: members };
  },
}));
