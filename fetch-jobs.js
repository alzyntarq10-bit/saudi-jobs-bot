
const fs = require("fs");

const QUERIES = [
  '"وظائف" "التقديم" "السعودية" when:7d',
  '"وظائف حكومية" "التقديم" when:7d',
  '"وظائف شركات" "السعودية" when:7d',
  '"توظيف" "الرياض" when:7d',
  '"توظيف" "جدة" when:7d'
];

const JOB_WORDS = /وظائف|وظيفة|توظيف|شواغر|فرص وظيفية|تعلن عن/i;
const EXCLUDE = /إغلاق باب التقديم|انتهاء التقديم|نتائج القبول|أسماء المقبولين/i;

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tag(xml, name) {
  const match = xml.match(
    new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i")
  );
  return match ? decode(match[1]).trim() : "";
}

async function getNews(query) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=ar&gl=SA&ceid=SA:ar";

  const response = await fetch(url, {
    headers: { "User-Agent": "SaudiJobsBot/1.0" },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`News feed HTTP ${response.status}`);
  }

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return items.map(item => {
    const title = tag(item, "title");
    const source = tag(item, "source") || "Google News";
    const url = tag(item, "link");
    const published = tag(item, "pubDate");

    return { title, source, url, published };
  });
}

async function main() {
  const all = [];
  let successfulSources = 0;

  for (const query of QUERIES) {
    try {
      const results = await getNews(query);
      all.push(...results);
      successfulSources++;
      console.log(`Fetched ${results.length} results`);
    } catch (error) {
      console.error("Feed error:", error.message);
    }
  }

  if (successfulSources === 0) {
    throw new Error("All feeds failed");
  }

  const unique = new Map();
  const now = Date.now();

  for (const item of all) {
    if (!JOB_WORDS.test(item.title)) continue;
    if (EXCLUDE.test(item.title)) continue;
    if (!item.url.startsWith("https://")) continue;

    const date = Date.parse(item.published);

    if (!Number.isFinite(date)) continue;
    if (date > now || now - date > 7 * 86400000) continue;

    const key = item.title.toLowerCase().trim();

    if (!unique.has(key)) {
      unique.set(key, {
        title: item.title,
        company: item.source,
        url: item.url,
        published: item.published,
        type: "إعلان توظيف - يحتاج التحقق"
      });
    }
  }

  const jobs = [...unique.values()].slice(0, 30);

  fs.writeFileSync(
    "jobs-data.json",
    JSON.stringify({ jobs }, null, 2)
  );

  console.log(`Saved ${jobs.length} job announcements`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
