// نظام وظائف السعودية
// تجهيز بيانات الوظائف والتحقق منها

function formatJob(job) {
  if (!job.title || !job.company || !job.url) {
    return null;
  }

  return `🇸🇦 فرصة وظيفية جديدة

📌 الوظيفة: ${job.title}
🏢 الجهة: ${job.company}
📍 المدينة: ${job.city || "السعودية"}

🔗 رابط التقديم:
${job.url}

#وظائف_السعودية`;
}

module.exports = { formatJob };
