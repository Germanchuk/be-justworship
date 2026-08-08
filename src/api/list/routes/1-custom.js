module.exports = {
  routes: [
    {
      method: "GET",
      path: "/bands/:bandId/lists",
      handler: "list.bandLists",
      config: {
        policies: ["global::is-authenticated", "global::has-band-access"],
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
      path: "/currentChurchLists",
      handler: "list.currentChurchLists",
      config: {
        policies: ["global::is-authenticated", "global::has-current-church"],
      },
    },
    {
      method: "GET",
      path: "/bands/:bandId/lists/:listId",
      handler: "list.findOneBandList",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::list.is-list-related-to-band",
        ],
      },
    },
    {
      method: "POST",
      path: "/bands/:bandId/lists",
      handler: "list.customCreate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
        ],
      },
    },
    {
      method: "PUT",
      path: "/bands/:bandId/lists/:listId",
      handler: "list.customUpdate",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::list.is-list-related-to-band",
        ],
      },
    },
    {
      method: "DELETE",
      path: "/bands/:bandId/lists/:listId",
      handler: "list.customDelete",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::list.is-list-related-to-band",
        ],
      },
    }
  ],
};
