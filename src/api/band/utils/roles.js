'use strict';

/**
 * Ролі в гурті.
 *
 * НАВІЩО САМЕ ТАК: `band.users` — це manyToMany без атрибутів, у Strapi на
 * такому зв'язку роль не запишеш. Тому склад гурту лишається в `users` (усі
 * перевірки доступу читають саме його й про ролі нічого не знають), а роль
 * виводиться з двох окремих relations: `leader` — рівно один, `guests` —
 * підмножина складу. Хто не лідер і не гість — учасник.
 *
 * Гість зараз має той самий доступ, що й учасник: роль лише зберігається й
 * показується. Обмеження функціональності — окремим кроком.
 */
const BAND_ROLES = {
  LEADER: 'leader',
  MEMBER: 'member',
  GUEST: 'guest',
};

/** Populate, з яким гурт вміє відповісти на питання «яка тут у мене роль». */
const ROLE_POPULATE = {
  leader: { fields: ['id'] },
  guests: { fields: ['id'] },
};

/** Роль юзера в гурті, завантаженому з `ROLE_POPULATE`. */
function roleOf(band, userId) {
  const id = Number(userId);

  if (band?.leader && Number(band.leader.id) === id) return BAND_ROLES.LEADER;
  if ((band?.guests ?? []).some((guest) => Number(guest.id) === id)) {
    return BAND_ROLES.GUEST;
  }
  return BAND_ROLES.MEMBER;
}

module.exports = { BAND_ROLES, ROLE_POPULATE, roleOf };
