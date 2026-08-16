module.exports = () => ({
    jwt: {
        expiresIn: '2y'
    },
    'users-permissions': {
        config: {
            // Реєстрація приймає РІВНО username/email/password. Без цього
            // Strapi дозволяє передати будь-яке публічне поле юзера — зокрема
            // `bands`, `ledBands`, `guestBands`, тобто вписати себе в чужий
            // гурт просто в тілі запиту на реєстрацію.
            register: {
                allowedFields: [],
            },
        },
    },
});
