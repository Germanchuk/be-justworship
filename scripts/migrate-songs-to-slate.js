'use strict';

/**
 * One-off migration: legacy song model -> Slate document snapshot.
 *
 * Strategy B (lazy bootstrap):
 *   We build a Slate document `Descendant[]` from the legacy fields
 *   (name, bpm, key, timeSignature, sections[]) and store it in the
 *   `song.slate` JSON column. The collab service then lazily creates the
 *   Yjs `song_collab_state` from this snapshot on first open, via its
 *   existing & tested `bootstrapFromSlate` path. No Yjs encoding here, so
 *   this script needs ZERO yjs/slate dependencies.
 *
 * Safety:
 *   - DRY-RUN BY DEFAULT. Pass `--apply` to actually write.
 *   - Idempotent: skips songs that already have a non-empty `slate`
 *     (created in the new editor or migrated earlier).
 *   - Never touches `sections` — it stays as the original-data backup.
 *
 * The header build mirrors collab `src/slateBridge.ts` makeHeader().
 * The body build mirrors pwa `withSections.ts` invariants (sections of
 * line/chord-line, separated by empty-line at root) and reuses the exact
 * `isChordsLine` logic from pwa `src/utils/keyUtils.ts`.
 *
 * Usage (from be-justworship root, env/.env pointing at the TARGET db):
 *   node scripts/migrate-songs-to-slate.js                 # dry-run, all songs
 *   node scripts/migrate-songs-to-slate.js --id 42         # dry-run, print doc for #42
 *   node scripts/migrate-songs-to-slate.js --apply         # APPLY to all songs
 *   node scripts/migrate-songs-to-slate.js --apply --id 42 # APPLY to one song
 */

const strapiFactory = require('@strapi/strapi');

// ---------------------------------------------------------------------------
// Chord detection — ported verbatim from pwa src/utils/keyUtils.ts.
// XRegExp named groups are valid in native RegExp, so no xregexp needed.
// ---------------------------------------------------------------------------
const TRIAD_PATTERN = '(M|maj|major|m|min|minor|dim|sus|dom|aug|\\+|-)';
const ADDED_TONE_PATTERN = '(\\(?([/\\.\\+]|add)?[#b]?\\d+[\\+-]?\\)?)';
const SUFFIX_PATTERN = `(?<suffix>\\(?${TRIAD_PATTERN}?${ADDED_TONE_PATTERN}*\\)?)`;
const BASS_PATTERN = '(\\/(?<bass>[A-G](#|b)?))?';
const ROOT_PATTERN = '(?<root>[A-G](#|b)?)';
const CHORD_REGEX = new RegExp(`^${ROOT_PATTERN}${SUFFIX_PATTERN}${BASS_PATTERN}$`);

function isChord(token) {
  return CHORD_REGEX.test(token);
}

function isChordsLine(line) {
  const str = line.replace(/[|.]/g, ' ');
  const chords = str.trim().split(/\s+/);
  return chords.every(isChord);
}

// ---------------------------------------------------------------------------
// Header — mirrors collab slateBridge.makeHeader (capo left empty: per-user,
// not part of the migration source fields).
// ---------------------------------------------------------------------------
function timeSignatureToDisplay(value) {
  if (value === 'threeFour') return '3/4';
  return '4/4'; // fourFour / undefined / unknown -> default
}

function makeHeader(song) {
  return [
    { type: 'song-name', children: [{ text: song.name ?? '' }] },
    {
      type: 'song-meta-row',
      children: [
        { type: 'bpm', children: [{ text: String(song.bpm ?? 0) }] },
        {
          type: 'time-signature',
          children: [{ text: timeSignatureToDisplay(song.timeSignature) }],
        },
        { type: 'song-key', keyValue: song.key ?? 'C', children: [{ text: '' }] },
        { type: 'capo', valuesBy: {}, children: [{ text: '' }] },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Body — mirrors withSections invariants:
//   - non-empty lines are grouped into `section` nodes (consecutive
//     non-empty lines = one section);
//   - an empty line (token === "") breaks the section and becomes an
//     `empty-line` at root;
//   - a line is `chord-line` iff isChordsLine(token), else `line`.
//   - legacy `spacing` = number of blank lines after a section (default 2),
//     so we emit `spacing - 1` extra empty-lines (matches sectionsToLinesStream).
// ---------------------------------------------------------------------------
function makeBody(sections) {
  const body = [];
  let current = null; // currently open section

  const pushEmpty = () => {
    current = null;
    body.push({ type: 'empty-line', children: [{ text: '' }] });
  };

  const pushLine = (token) => {
    const type = isChordsLine(token) ? 'chord-line' : 'line';
    if (!current) {
      current = { type: 'section', children: [] };
      body.push(current);
    }
    current.children.push({ type, children: [{ text: token }] });
  };

  for (const sec of sections ?? []) {
    const content = (sec.content ?? '').replace(/\r\n/g, '\n');
    for (const raw of content.split('\n')) {
      if (raw === '') pushEmpty();
      else pushLine(raw);
    }
    const spacing = typeof sec.spacing === 'number' ? sec.spacing : 2;
    for (let i = 0; i < Math.max(0, spacing - 1); i++) pushEmpty();
  }

  // Always leave a focusable node so the editor never opens on an empty root.
  if (body.length === 0) {
    body.push({ type: 'empty-line', children: [{ text: '' }] });
  }
  return body;
}

function buildSlateDoc(song) {
  return [...makeHeader(song), ...makeBody(song.sections)];
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const apply = process.argv.includes('--apply');
  const idIdx = process.argv.indexOf('--id');
  const onlyId = idIdx !== -1 ? Number(process.argv[idIdx + 1]) : null;

  const app = await strapiFactory().load();
  app.log.level = 'error';

  const where = onlyId ? { id: onlyId } : {};
  const songs = await app.db.query('api::song.song').findMany({
    where,
    select: ['id', 'name', 'bpm', 'key', 'timeSignature', 'slate'],
    populate: { sections: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const song of songs) {
    const hasSlate = Array.isArray(song.slate) && song.slate.length > 0;
    if (hasSlate) {
      skipped++;
      continue;
    }

    const doc = buildSlateDoc(song);

    if (apply) {
      await app.entityService.update('api::song.song', song.id, {
        data: { slate: doc },
      });
    }

    migrated++;
    console.log(
      `${apply ? 'migrated' : '[dry] would migrate'} #${song.id} "${song.name}"` +
        ` — sections=${song.sections ? song.sections.length : 0}, nodes=${doc.length}`,
    );
    if (onlyId) console.log(JSON.stringify(doc, null, 2));
  }

  console.log(
    `\n${apply ? 'APPLIED' : 'DRY-RUN'}: ${migrated} migrated, ` +
      `${skipped} skipped (already had slate), ${songs.length} total.`,
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
