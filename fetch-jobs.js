
const fs = require("fs");

const QUERIES = [
  '"وظائف" "التقديم" "السعودية" when:7d',
  '"وظائف حكومية" "التقديم" when:7d',
  '"وظائف شركات" "السعودية" when:7d',
  '"فرص وظيفية" "الرياض" when:7d',
  '"وظائف شاغرة" "جدة" when:7d',
  '"وظائف" "الدمام" when:7d',
  '"فتح باب التوظيف" "السعودية" when:7d',
  '"التقديم على وظائف" "السعودية" when:7d'
];

const JOB_WORDS =
  /وظائف|وظيفة|توظيف|فرص وظيفية|فرص عمل|شواغر|مطلوب موظفين|فتح باب التقديم|فتح باب التوظيف/i;

const ACTION_WORDS =
  /التقديم|تقدم|التسجيل|فتح باب|تعلن|يعلن|مطلوب|شواغر|فرص|توظيف/i;

const SAUDI_WORDS =
  /السعودية|السعودي|المملكة|الرياض|جدة|مكة|المدينة|الدمام|الخبر|الظهران|الطائف|تبوك|أبها|خميس مشيط|جازان|نجران|حائل|بريدة|عنيزة|القصيم|الأحساء|الجبيل|ينبع|الخرج|الباحة|عرعر|سكاكا/i;

const EXCLUDE =
  /ترامب|إسرائيل|الحرب|سياسة|انتخابات|تحليل|رأي|توقعات|الأزهر|القاهرة|العراق|الأردن|الكويت|الإمارات|قطر|البحرين|المغرب|الجزائر|تونس|السودان|باكستان|الهند|نتائج القبول|إغلاق باب التقديم|انتهاء التقديم|رواتب الموظفين|مميزات وعيوب|كيف تحصل|نصائح|احتيال|وهمية/i;

const CITIES = [
  "الرياض", "جدة", "مكة", "المدينة",
  "الدمام", "الخبر", "الظهران",
  "الطائف", "تبوك", "أبها",
  "خميس مشيط", "جازان", "نجران",
  "حائل", "بريدة", "عنيزة",
  "القصيم", "الأحساء", "الجبيل",
  "ينبع", "الخرج", "الباحة",
  "عرعر", "سكاكا"
];

const GOVERNMENT =
  /وزارة|هيئة|جامعة حكومية|أمانة|بلدية|مستشفى حكومي|الدفاع المدني|الحرس الوطني|المديرية العامة|القطاع الحكومي|وظائف حكومية/i;

function decode(text = "") {
  return String(text)
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
      `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
      "i"
    )
  );

  return match ? decode(match[1]).trim() : "";
}

function clean(text = "") {
  return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCity(text) {
  return CITIES.find(city => text.includes(city)) || "";
}

function getSector(text) {
  if (GOVERNMENT.test(text)) return "حكومي";
  if (/شركة|شركات|قطاع خاص|مؤسسة خاصة/i.test(text)) {
    return "خاص";
  }
  return "غير محدد";
}

function validUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

async function getNews(query) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=ar&gl=SA&ceid=SA:ar";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "SaudiJobsBot/2.0"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(
      `Google News HTTP ${response.status}`
    );
  }

  const xml = await response.text();

  const items =
    xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items.map(item => ({
    title: clean(tag(item, "title")),
    source: clean(tag(item, "source")),
    description: clean(tag(item, "description")),
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
        `Fetched ${results.length} items`
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
    const text = title + " " + item.description;

    if (!JOB_WORDS.test(title)) continue;
    if (!ACTION_WORDS.test(text)) continue;
    if (!SAUDI_WORDS.test(text)) continue;
    if (EXCLUDE.test(title)) continue;
    if (!validUrl(item.url)) continue;

    const date = Date.parse(item.published);

    if (!Number.isFinite(date)) continue;
    if (date > now) continue;
    if (now - date > 7 * 86400000) continue;

    const city = getCity(text);
    const sector = getSector(text);

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
      city,
      sector,
      type: sector,
      url: item.url,
      published: item.published,
      linkType: "news",
      verified: false
    });
  }

  const jobs = [...unique.values()]
    .sort((a, b) =>
      Date.parse(b.published) -
      Date.parse(a.published)
    )
    .slice(0, 30);

  // Avoid overwriting existing jobs if
  // no matching results were found.
  if (jobs.length === 0) {
    console.log(
      "No matching jobs. Existing file preserved."
    );
    return;
  }

  fs.writeFileSync(
    "jobs-data.json",
    JSON.stringify({ jobs }, null, 2)
  );

  console.log(
    `Saved ${jobs.length} Saudi job announcements`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
