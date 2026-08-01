const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

const SONG_CONTENT_ID = "#music_text";
const SONG_BLOCK_CLASS = ".blocks";
const BLOCK_CHORDS_CLASS = "chopds"; // wtf?

module.exports = {
  async scrapeHolychords(url) {
    try {
        console.log(url);
      const res = await getParsedSong(url);
      return res;
    } catch (err) {
      strapi.log.error("Error in custom service:", err);
      throw err;
    }
  },
};

const makeNode = (type, text) => ({ type, children: [{ text }] });
const makeEmptyLine = () => makeNode("empty-line", "");

/**
 * Holychords віддає &nbsp; і \r, а акорди вирівнює пробілами на початку рядка,
 * тому зрізаємо лише кінець — інакше акорди "з'їдуть" відносно тексту.
 */
function normalizeRowText(raw) {
  return raw.replace(/ /g, " ").replace(/\r/g, "").replace(/\s+$/, "");
}

/** Клас може бути як на самому рядку, так і на вкладеному span — перевіряємо обидва. */
function hasClass($row, className) {
  const own = ($row.attr("class") || "").split(/\s+/).includes(className);
  return own || $row.find(`.${className}`).length > 0;
}

async function getParsedSong(url) {
  const $ = await getSelector(url);

  const $songContent = $(SONG_CONTENT_ID);
  const $blocks = $songContent.find(SONG_BLOCK_CLASS);
  const $songName = $("h2.t-worship-leader__marquee__headline")

  /**
   * Один `.blocks` → одна Slate-секція; рядок з класом `chopds` → `chord-line`,
   * решта → `line`. Якщо клас на сайті бреше, редактор перекласифікує рядок сам
   * (нормалізатор `withSections` звіряє вміст через `isChordsLine`).
   */
  function getSection($block) {
    const children = [];

    $block.contents().each((index, row) => {
      const $row = $(row);
      if (!$row.contents().length) return;

      const content = normalizeRowText($row.text());
      // Порожні рядки всередині секції редактор все одно виносить у корінь.
      if (!content.trim()) return;

      const type = hasClass($row, BLOCK_CHORDS_CLASS) ? "chord-line" : "line";
      children.push(makeNode(type, content));
    });

    return children.length ? { type: "section", children } : null;
  }

  /**
   * Повертаємо ТІЛО документа без хедера (song-name + song-meta-row): collab
   * бачить `fallbackSlate` без хедера і будує хедер сам з полів пісні
   * (`bootstrapWithHeader` у slateBridge.ts), тож дублювати його тут не треба.
   */
  function getSong() {
    const slate = [];

    $blocks.each((index, blockElement) => {
      const section = getSection($(blockElement));
      if (!section) return;

      // Сусідні секції редактор зливає в одну — розділяємо порожнім рядком.
      if (slate.length) slate.push(makeEmptyLine());
      slate.push(section);
    });

    return {
      name: $songName.text().trim(),
      slate,
    };
  }

  return getSong();
}

async function getSelector(url) {
  // Launch a headless browser
  // @ts-ignore
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  // Open a new page
  const page = await browser.newPage();

  // Navigate to the website
  await page.goto(url); // Replace with the URL of the website you want to scrape

  // Wait for some time or for specific elements to load or execute JavaScript
  // For example, you can wait for a specific element to appear:
  // await page.waitForSelector('your-selector');

  // Get the HTML of the page after JavaScript has executed
  const html = await page.content();

  // Close the browser
  await browser.close();

  return cheerio.load(html);
}
