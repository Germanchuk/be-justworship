module.exports = {
  routes: [
    {
      method: "POST",
      path: "/bands/:bandId/parseHolychords",
      handler: "song.parseHolychords",
      config: {
        policies: ["global::is-authenticated", "global::has-band-access"],
      },
    },
    {
      method: "GET",
      path: "/bands/:bandId/songs",
      handler: "song.bandSongs",
      config: {
        policies: ["global::is-authenticated", "global::has-band-access"],
      },
    },
    {
      // Пошук пісні по всіх гуртах юзера. Гурт у відповіді, а не в запиті:
      // та сама пісня може лежати в кількох гуртах, і це різні пісні.
      method: "GET",
      path: "/searchSongs",
      handler: "song.searchMySongs",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "GET",
      path: "/currentChurchSongs",
      handler: "song.currentChurchSongs",
      config: {
        policies: ["global::is-authenticated", "global::has-current-church"],
      },
    },
    {
      method: "GET",
      path: "/bands/:bandId/songs/:songId",
      handler: "song.findOneBandSong",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::song.is-song-related-to-band",
        ],
      },
    },
    {
      method: "POST",
      path: "/bands/:bandId/songs",
      handler: "song.customCreate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access"
        ],
      },
    },
    {
      method: "PUT",
      path: "/bands/:bandId/songs/:songId",
      handler: "song.customUpdate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::song.is-song-related-to-band",
        ],
      },
    },
    {
      method: "DELETE",
      path: "/bands/:bandId/songs/:songId",
      handler: "song.customDelete",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::song.is-song-related-to-band",
        ],
      },
    },
    {
      // Копіювання: `:bandId` — куди кладемо, `:songId` — звідки беремо.
      // Джерело може бути з будь-якого гурту юзера, тому окрема політика.
      method: "POST",
      path: "/bands/:bandId/songs/:songId/copy",
      handler: "song.copySong",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::song.is-song-in-my-bands",
        ],
      },
    }
  ],
};
