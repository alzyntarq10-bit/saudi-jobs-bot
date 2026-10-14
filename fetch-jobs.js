
const fs = require("fs");

const QUERIES = [
  '"وظائف شاغرة" "السعودية" when:7d',
  '"وظائف شاغرة" "الرياض" when:7d',
  '"وظائف شاغرة" "جدة" when:7d',
  '"وظائف شاغرة" "الدمام" when:7d',
  '"فرص وظيفية" "السعودية" when:7d',
  '"فتح باب التوظيف" "السعودية" when:7d',
  '"بدء التقديم" "وظائف" "السعودية" when:7d'
];

const JOB_WORDS =
  /وظائف شاغرة|وظائف متاحة|فرص وظيفية|فرص عمل|فتح باب التوظيف|بدء التقديم|يعلن عن وظائف|تعلن عن وظائف|طرح \d+ وظيفة|تطرح \d+ وظيفة|مطلوب موظفين|مطلوب للتوظيف/i;

const SAUDI_WORDS =
  /السعودية|السعودي|السعودية|المملكة العربية السعودية|الرياض|جدة|مكة|المدينة المنورة|الدمام|الخبر|الظهران|الطائف|تبوك|أبها|خميس مشيط|جازان|نجران|حائل|بريدة|عنيزة|القصيم|الأحساء|الجبيل|ينبع|الخرج|الباحة|عرعر|سكاكا/i;

const EXCLUDE =
  /وزير|تصريحات|استثمارات|مميزات وعيوب|كيف|لماذا|تحليل|رأي|الحرب|إسرائيل|الإسرائيلي|ترامب|اتفاقية|توقعات|تقرير|رواتب الموظفين|نتائج القبول|انتهاء التقديم|إغلاق باب التقديم|الأزهر|مصر|القاهرة|العراق|الأردن|الكويت|الإمارات|قطر|البحرين|سلطنة عمان|المغرب|الجزائر|تونس|السودان|سوريا|لبنان|باكستان|الهند/i;

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
      company:
        "المصدر: " +
        (item.source || "Google News"),
      url: item.url,
      published: item.published,
      type:
        "خبر توظيف - تحقق من الشروط والرابط"
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
  process.exitCode = 1;
});
