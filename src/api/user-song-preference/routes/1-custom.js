module.exports = {
  routes: [
    {
      method: "GET",
      path: "/getPreferencesBySongId/:songId",
      handler: "user-song-preference.getPreferencesBySongId",
      config: {
        policies: [
          "global::is-authenticated",
        ],
      },
    },
    {
      method: "PUT",
      path: "/savePreference/:preferenceId",
      handler: "user-song-preference.savePreference",
      config: {
        policies: [
          "global::is-authenticated",
          "api::user-song-preference.is-preference-related-to-user"
        ],
      },
    },
    {
      method: "POST",
      path: "/createPreference/:songId",
      handler: "user-song-preference.createPreference",
      config: {
        policies: [
          "global::is-authenticated"
        ],
      },
    }
  ],
};
