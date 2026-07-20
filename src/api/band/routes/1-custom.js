module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/currentBand/playerDevice",
      handler: "band.setPlayerDevice",
      config: {
        policies: ["global::is-authenticated", "global::has-current-band"],
      },
    },
  ],
};
