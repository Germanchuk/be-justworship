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
      // Створення гурту: автор одразу стає учасником і лідером.
      // Шлях свідомо не `POST /bands` — це core-роут `band.create`, а порядок
      // реєстрації роутів між файлами Strapi не гарантує, тож перекривати його
      // ненадійно. `/bands/new` ні з чим не конфліктує.
      method: "POST",
      path: "/bands/new",
      handler: "band.createBand",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      // Видалення гурту (насправді — архівація, див. контролер). Єдина дія,
      // закрита роллю: лише лідер.
      // Шлях не `DELETE /bands/:bandId` — це core-роут `band.delete`, а
      // порядок реєстрації роутів між файлами Strapi не гарантує.
      method: "PUT",
      path: "/bands/:bandId/archive",
      handler: "band.archiveBand",
      config: {
        policies: [
          "global::is-authenticated",
          "global::has-band-access",
          "api::band.is-band-leader",
        ],
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
