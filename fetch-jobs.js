
const fs = require("fs");

const QUERIES = [
  '"وظائف" "السعودية" when:7d',
  '"وظائف" "الرياض" when:7d',
  '"وظائف" "جدة" when:7d',
  '"وظائف" "الدمام" when:7d',
  '"وظائف" "المدينة المنورة" when:7d',
  '"وظائف" "مكة المكرمة" when:7d',
  '"توظيف" "المملكة العربية السعودية" when:7d'
];

const JOB_WORDS =
  /وظائف|وظيفة|توظيف|شواغر|فرص وظيفية|فرص عمل/i;

const SAUDI_WORDS =
  /السعودية|المملكة العربية السعودية|الرياض|جدة|مكة المكرمة|المدينة المنورة|الدمام|الخبر|الظهران|الطائف|تبوك|أبها|خميس مشيط|جازان|نجران|حائل|بريدة|عنيزة|القصيم|الأحساء|الجبيل|ينبع|الخرج|الباحة|عرعر|سكاكا/i;

const EXCLUDE =
  /جامعة الأزهر|الأزهر الشريف|جمهورية مصر|القاهرة|الإسكندرية|وزارة العمل المصرية|وظائف مصر|العراق|الأردن|الكويت|الإمارات|قطر|البحرين|عمان|سلطنة عمان|المغرب|الجزائر|تونس|السودان|سوريا|لبنان|فلسطين|باكستان|الهند|إغلاق باب التقديم|انتهاء التقديم|نتائج القبول|أسماء المقبولين|مسابقة توظيف|رواتب الموظفين|إجازة رسمية/i;

function decode(text = "") {
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
    new RegExp(
      `<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,
      "i"
    )
  );
  return match ? decode(match[1]).trim() : "";
}

async function getNews(query) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=ar&gl=SA&ceid=SA:ar";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "SaudiJobsBot/1.0"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(
      `News feed HTTP ${response.status}`
    );
  }

  const xml = await response.text();

  const items =
    xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return items.map(item => ({
    title: tag(item, "title"),
    source: tag(item, "source"),
    url: tag(item, "link"),
    published: tag(item, "pubDate")
  }));
}

async function main() {
  const all = [];
  let successfulSources = 0;

  for (const query of QUERIES) {
    try {
      const results = await getNews(query);
      all.push(...results);
      successfulSources++;

      console.log(
        `Fetched ${results.length} results`
      );
    } catch (error) {
      console.error(
        "Feed error:",
        error.message
      );
    }
  }

  if (successfulSources === 0) {
    throw new Error("All feeds failed");
  }

  const unique = new Map();
  const now = Date.now();

  for (const item of all) {
    const title = item.title || "";

    if (!JOB_WORDS.test(title)) continue;
    if (!SAUDI_WORDS.test(title)) continue;
    if (EXCLUDE.test(title)) continue;

    if (
      !item.url ||
      !item.url.startsWith("https://")
    ) continue;

    const date = Date.parse(item.published);

    if (!Number.isFinite(date)) continue;

    if (
      date > now ||
      now - date > 7 * 86400000
    ) continue;

    const key = title
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (unique.has(key)) continue;

    unique.set(key, {
      title,
      company: "المصدر: " +
        (item.source || "Google News"),
      url: item.url,
      published: item.published,
      type: "خبر توظيف - تحقق من الشروط والرابط"
    });
  }

  const jobs = [...unique.values()]
    .slice(0, 15);

  fs.writeFileSync(
    "jobs-data.json",
    JSON.stringify({ jobs }, null, 2)
  );

  console.log(
    `Saved ${jobs.length} Saudi job news items`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
