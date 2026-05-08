'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { NotFoundError, ValidationError } = require('@strapi/utils').errors;

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
      fields: ['id', 'slate'],
    });
    if (!song) throw new NotFoundError('Song not found');

    const existing = await findStateBySong(strapi, songId);

    if (existing) {
      return {
        state: existing.state,
        version: existing.version ?? 0,
        fallbackSlate: null,
      };
    }

    // Lazy-migration path: collab-server bootstraps a Y.Doc from this
    // and on first save we'll persist `state`, after which fallbackSlate
    // is no longer returned.
    return {
      state: null,
      version: 0,
      fallbackSlate: song.slate ?? null,
    };
  },

  async putInternal(ctx) {
    const { songId } = ctx.params;
    const body = ctx.request.body || {};
    const { state, version, slate } = body;

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

    const saved = existing
      ? await strapi.entityService.update(UID, existing.id, {
          data: { state, version: nextVersion },
        })
      : await strapi.entityService.create(UID, {
          data: { state, version: nextVersion, song: songId },
        });

    const songUpdate = { lastCollabSavedAt: new Date() };
    if (Array.isArray(slate)) {
      songUpdate.slate = slate;
    }
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
      { populate: ['currentBand'] },
    );

    if (!user) {
      return { allowed: false, user: null };
    }

    const currentBandId = user.currentBand?.id;
    if (!currentBandId) {
      return { allowed: false, user: { id: user.id, name: user.username } };
    }

    const song = await strapi.entityService.findOne(SONG_UID, songId, {
      populate: ['owner'],
    });

    const allowed = !!(
      song &&
      song.owner &&
      song.owner.id === currentBandId
    );

    return {
      allowed,
      user: { id: user.id, name: user.username },
    };
  },
}));
