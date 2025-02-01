module.exports = {
  routes: [
    {
      method: "POST",
      path: "/parseHolychords",
      handler: "song.parseHolychords",
      config: {
        policies: ["global::is-authenticated", "global::has-current-band"],
      },
    },
    {
      method: "GET",
      path: "/currentBandSongs",
      handler: "song.currentBandSongs",
      config: {
        policies: ["global::is-authenticated", "global::has-current-band"],
      },
    },
    {
      method: "GET",
      path: "/currentChurchSongs",
      handler: "song.currentChurchSongs",
      config: {
        policies: ["global::is-authenticated", "global::has-current-band", "global::has-current-church"],
      },
    },
    {
      method: "GET",
      path: "/currentBandSongs/:songId",
      handler: "song.findOneBandSong",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-current-band",
          "api::song.is-song-related-to-band",
        ],
      },
    },
    {
      method: "POST",
      path: "/currentBandSongs",
      handler: "song.customCreate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-current-band",
        ],
      },
    },
    {
      method: "PUT",
      path: "/currentBandSongs/:songId",
      handler: "song.customUpdate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-current-band",
          "api::song.is-song-related-to-band",
        ],
      },
    },
    {
      method: "DELETE",
      path: "/currentBandSongs/:songId",
      handler: "song.customDelete",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-current-band",
          "api::song.is-song-related-to-band",
        ],
      },
    }
  ],
};
