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
      fields: ['id', 'slate', 'name', 'bpm', 'key', 'timeSignature'],
    });
    if (!song) throw new NotFoundError('Song not found');

    // Per-user preferences (transposition, hideChords) — used by collab to
    // seed song-meta-row.capoBy / hideChordsFor on first migration of a song.
    const preferences = await strapi.entityService.findMany(
      'api::user-song-preference.user-song-preference',
      {
        filters: { song: { id: songId } },
        populate: ['user'],
      },
    );

    const fallbackPreferences = (preferences || [])
      .filter((p) => p.user?.username)
      .map((p) => ({
        username: p.user.username,
        transposition: p.transposition ?? 0,
        hideChords: !!p.hideChords,
      }));

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
        fallbackPreferences,
      };
    }

    return {
      state: null,
      version: 0,
      fallbackSlate: song.slate ?? null,
      fallbackMeta,
      fallbackPreferences,
    };
  },

  async putInternal(ctx) {
    const { songId } = ctx.params;
    const body = ctx.request.body || {};
    const { state, version, slate, name, bpm, key, timeSignature } = body;

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
