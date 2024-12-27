module.exports = {
  routes: [
    {
      method: "GET",
      path: "/currentBandLists",
      handler: "list.currentBandLists",
      config: {
        policies: ["global::is-authenticated", "api::list.check-current-band"],
      },
    },
    {
      method: "GET",
      path: "/myLists",
      handler: "list.findMyLists",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "GET",
      path: "/currentBandLists/:listId",
      handler: "list.findOneBandList",
      config: {
        policies: [
          "global::is-authenticated",
          "api::list.check-current-band",
          "api::list.is-list-related-to-band",
        ],
      },
    },
  ],
};
