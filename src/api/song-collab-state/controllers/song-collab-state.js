'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { NotFoundError, ValidationError } = require('@strapi/utils').errors;
const { findActiveBandIdsOf } = require('../../band/utils/soft-delete');

const UID = 'api::song-collab-state.song-collab-state';
const SONG_UID = 'api::song.song';

async function findStateBySong(strapi, songId) {
  const results = await strapi.entityService.findMany(UID, {
    filters: { song: { id: songId } },
    fields: ['id', 'state', 'version'],
    limit: 1,
  });
  return results[0] || null;
}

module.exports = createCoreController(UID, ({ strapi }) => ({
  async getInternal(ctx) {
    const { songId } = ctx.params;

    const song = await strapi.entityService.findOne(SONG_UID, songId, {
      fields: ['id', 'slate', 'name', 'bpm', 'key', 'timeSignature'],
    });
    if (!song) throw new NotFoundError('Song not found');

    const fallbackMeta = {
      name: song.name ?? '',
      bpm: typeof song.bpm === 'number' ? song.bpm : 0,
      key: song.key ?? 'C',
      timeSignature: song.timeSignature ?? 'fourFour',
    };

    const existing = await findStateBySong(strapi, songId);

    if (existing) {
      return {
        state: existing.state,
        version: existing.version ?? 0,
        fallbackSlate: null,
        fallbackMeta,
      };
    }

    return {
      state: null,
      version: 0,
      fallbackSlate: song.slate ?? null,
      fallbackMeta,
    };
  },

  async putInternal(ctx) {
    const { songId } = ctx.params;
    const body = ctx.request.body || {};
    const {
      state,
      version,
      slate,
      slateFull,
      name,
      bpm,
      key,
      timeSignature,
    } = body;

    if (typeof state !== 'string' || state.length === 0) {
      throw new ValidationError('state must be a non-empty base64 string');
    }

    const song = await strapi.entityService.findOne(SONG_UID, songId, {
      fields: ['id'],
    });
    if (!song) throw new NotFoundError('Song not found');

    const existing = await findStateBySong(strapi, songId);

    const nextVersion = Number.isInteger(version)
      ? version
      : (existing?.version ?? 0) + 1;

    // `slateFull` — повний Slate-документ, як його бачить редактор, з усіма
    // per-user даними (примітки, капо, згорнуті секції, режими показу).
    // Живе тут, а НЕ на пісні: `song.slate` віддається клієнтам звичайним
    // REST-ом, а ця таблиця доступна лише через internal-ендпоінти. Це резервна
    // копія на випадок, якщо Yjs-стан зіпсується — джерело правди лишається
    // `state`. Пропущений/некоректний `slateFull` не затирає попередній:
    // краще трохи застаріла копія, ніж жодної.
    const stateData = { state, version: nextVersion };
    if (Array.isArray(slateFull)) stateData.slateFull = slateFull;

    const saved = existing
      ? await strapi.entityService.update(UID, existing.id, { data: stateData })
      : await strapi.entityService.create(UID, {
          data: { ...stateData, song: songId },
        });

    const songUpdate = { lastCollabSavedAt: new Date() };
    if (Array.isArray(slate)) songUpdate.slate = slate;
    if (typeof name === 'string') songUpdate.name = name;
    if (typeof bpm === 'number' && Number.isFinite(bpm)) songUpdate.bpm = bpm;
    if (typeof key === 'string') songUpdate.key = key;
    if (typeof timeSignature === 'string') songUpdate.timeSignature = timeSignature;
    await strapi.entityService.update(SONG_UID, songId, { data: songUpdate });

    return { id: saved.id, version: saved.version };
  },

  async accessCheck(ctx) {
    const { songId } = ctx.params;
    const userIdRaw = ctx.query?.userId;
    const userId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;

    if (!userId) {
      throw new ValidationError('userId query parameter is required');
    }

    const user = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      userId,
    );

    if (!user) {
      return { allowed: false, user: null };
    }

    // Документ collab іменується `song:<id>` і гурта в собі не несе, тому
    // доступ рахуємо від усіх гуртів юзера: пісня має належати одному з них.
    // Видалений гурт сюди не потрапляє — редактор його пісень не відкриє.
    const userBandIds = await findActiveBandIdsOf(strapi, user.id);
    if (userBandIds.length === 0) {
      return { allowed: false, user: { id: user.id, name: user.username } };
    }

    const song = await strapi.entityService.findOne(SONG_UID, songId, {
      populate: ['owner'],
    });

    const allowed = !!(
      song &&
      song.owner &&
      userBandIds.includes(song.owner.id)
    );

    return {
      allowed,
      user: { id: user.id, name: user.username },
    };
  },
}));
