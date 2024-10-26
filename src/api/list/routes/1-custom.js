module.exports = {
  routes: [
    {
      method: "GET",
      path: "/currentBandLists",
      handler: "list.currentBandLists",
    },
    {
      method: "GET",
      path: "/myLists",
      handler: "list.findMyLists",
    }
  ],
};
