
function formatJob(job) {
  if (!job.title || !job.url) {
    return null;
  }

  const title = String(job.title).trim();
  const url = String(job.url).trim();

  if (!url.startsWith("https://")) {
    return null;
  }

  const source = String(job.company || "")
    .replace(/^المصدر:\s*/i, "")
    .trim();

  const city = job.city
    ? `📍 الموقع: ${job.city}\n`
    : "";

  const isNews =
    url.includes("news.google.com") ||
    job.type?.includes("خبر توظيف");

  const linkLabel = isNews
    ? "🔗 رابط الخبر والتفاصيل:"
    : "🔗 رابط الإعلان:";

  return `🇸🇦 إعلان توظيف في السعودية

📌 العنوان: ${title}
${source ? `📰 المصدر الإخباري: ${source}\n` : ""}${city}
${isNews ? "⚠️ هذا خبر توظيف، وليس رابط تقديم مباشرًا.\nتحقق من جهة التوظيف والشروط قبل التقديم.\n" : ""}
${linkLabel}
${url}

#وظائف_السعودية`;
}

module.exports = { formatJob };
