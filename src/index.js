'use strict';

// Дозволи в Strapi прив'язані до імені хендлера, а не до шляху. Оскільки всі
// ці екшени й так закриті політиками `is-authenticated` + `has-band-access`,
// тримаємо їхні гранти тут: інакше кожне перейменування хендлера доводиться
// доклацувати руками в адмінці кожного середовища.
const PUBLIC_AUTHENTICATED_ACTIONS = [
  // Хост звуку гурту (віддалене програвання).
  'api::band.band.setAudioHost',
  // Склад гурту — для вибору адресата приміток у режимі приміток.
  'api::band.band.bandMembers',
  // Головний екран — список гуртів юзера.
  'api::band.band.myBands',
  // Створення гурту (автор стає лідером).
  'api::band.band.createBand',
  // Видалення гурту = архівація (лише лідер, політика `is-band-leader`).
  'api::band.band.archiveBand',
  // Пісні гурту.
  'api::song.song.bandSongs',
  'api::song.song.findOneBandSong',
  'api::song.song.customCreate',
  'api::song.song.customUpdate',
  'api::song.song.customDelete',
  'api::song.song.copySong',
  // Пошук пісні по всіх гуртах юзера.
  'api::song.song.searchMySongs',
  'api::song.song.parseHolychords',
  // Списки служінь гурту.
  'api::list.list.bandLists',
  'api::list.list.findMyLists',
  'api::list.list.findOneBandList',
  'api::list.list.customCreate',
  'api::list.list.customUpdate',
  'api::list.list.customDelete',
];

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Ensure custom actions are permitted for the Authenticated role so the
    // feature works out of the box without manual admin toggles.
    const role = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (!role) return;

    for (const action of PUBLIC_AUTHENTICATED_ACTIONS) {
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: role.id } });

      if (!existing) {
        await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: role.id } });
      }
    }
  },
};
