const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

const SONG_CONTENT_ID = "#music_text";
const SONG_BLOCK_CLASS = ".blocks";
const BLOCK_TEXT_CLASS = "text";
const BLOCK_CHORDS_CLASS = "chopds"; // wtf?
const BLOCK_TITLE_CLASS = "videlit_line";

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

const ItemType = {
  CHORD: "chord",
  TEXT: "text",
  HINT: "hint",
  EMPTY: "empty",
};

async function getParsedSong(url) {
  const $ = await getSelector(url);

  const $songContent = $(SONG_CONTENT_ID);
  const $blocks = $songContent.find(SONG_BLOCK_CLASS);
  const $songName = $("h2.t-worship-leader__marquee__headline")

  const song = getSong();

  function getBlock($block) {
    const block = {
      content: [],
    };

    $block.contents().each((index, row) => {
      const $row = $(row);
      //  handle the Title
      if ($row.hasClass(BLOCK_TITLE_CLASS)) {
        block.title = $row.text().trim();
      }
      //  handle the Chords
      if ($row.hasClass(BLOCK_CHORDS_CLASS) && $row.contents().length) {
        block.content.push({
          type: ItemType.CHORD,
          content: $row.text().trim(),
        });
      }
      //  handle the Text
      if ($row.hasClass(BLOCK_TEXT_CLASS)) {
        block.content.push({
          type: ItemType.TEXT,
          content: $row.text().trim(),
        });
      }
      // handle empty line
      if ($row.hasClass(BLOCK_CHORDS_CLASS) && !$row.contents().length) {
        block.content.push({
          type: ItemType.EMPTY,
          content: [],
        });
      }
    });

    return block;
  }

  function getSong() {
    const song = {
      name: $songName.text().trim(),
      content: [],
    };

    $blocks.each((index, blockElement) => {
      const block = getBlock($(blockElement));
      song.content.push(block);
    });

    return song;
  }

  return song;
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
