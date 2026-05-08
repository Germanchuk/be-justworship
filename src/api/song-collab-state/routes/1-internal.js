'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/internal/songs/:songId/collab-state',
      handler: 'song-collab-state.getInternal',
      config: {
        auth: false,
        policies: ['global::is-collab-service'],
      },
    },
    {
      method: 'PUT',
      path: '/internal/songs/:songId/collab-state',
      handler: 'song-collab-state.putInternal',
      config: {
        auth: false,
        policies: ['global::is-collab-service'],
      },
    },
    {
      method: 'GET',
      path: '/internal/songs/:songId/access-check',
      handler: 'song-collab-state.accessCheck',
      config: {
        auth: false,
        policies: ['global::is-collab-service'],
      },
    },
  ],
};
