module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      origin: [
        'http://localhost:1337',
        'http://localhost:5173',
        'https://justworship.uk',       // Ваші старі домени
        'https://new.justworship.uk'    // <--- ВАШ НОВИЙ ДОМЕН (без слеша в кінці!)
      ]
    }
  },
];
