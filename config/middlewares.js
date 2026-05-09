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
      origin: (ctx) => {
        const requestOrigin = ctx.request.header.origin;
        if (!requestOrigin) return false;
        const allowed = [
          'http://localhost:1337',
          'http://localhost:5173',
          'https://justworship.uk',
          'https://new.justworship.uk',
        ];
        const lanRegex = [
          /^http:\/\/192\.168\.\d+\.\d+:5173$/,
          /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,
          /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:5173$/,
        ];
        if (allowed.includes(requestOrigin)) return requestOrigin;
        if (lanRegex.some((re) => re.test(requestOrigin))) return requestOrigin;
        return false;
      },
    }
  },
];
