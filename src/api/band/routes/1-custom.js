module.exports = {
  routes: [
    {
      // Головний екран: усі гурти юзера з коротким прев'ю активності.
      method: "GET",
      path: "/myBands",
      handler: "band.myBands",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      // Хост звуку гурту (durable-призначення; жива правда — в awareness).
      method: "PUT",
      path: "/bands/:bandId/audioHost",
      handler: "band.setAudioHost",
      config: {
        policies: ["global::is-authenticated", "global::has-band-access"],
      },
    },
    {
      method: "GET",
      path: "/bands/:bandId/members",
      handler: "band.bandMembers",
      config: {
        policies: ["global::is-authenticated", "global::has-band-access"],
      },
    },
  ],
};
