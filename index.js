const http = require("http");
const { formatJob } = require("./jobs");
const jobsData = require("./jobs-data.json");
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
async function sendMessage(chatId, text) {
  if (!TOKEN) return;

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Saudi Jobs Bot is running!");
    return;
  }

  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const update = JSON.parse(body);

        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || "";

          if (text === "/start") {
            await sendMessage(
              chatId,
              "🇸🇦 أهلاً بك في بوت وظائف السعودية\n\nاكتب /jobs لعرض الوظائف."
            );
          } else if (text === "/jobs") {
            await sendMessage(
              chatId,
              "💼 أحدث الوظائف في السعودية ستظهر هنا قريباً."
            );
          } else {
            await sendMessage(
              chatId,
              "استخدم /start للبدء أو /jobs لعرض الوظائف."
            );
          }
        }

        res.writeHead(200);
        res.end("OK");
      } catch (error) {
        console.error(error);
        res.writeHead(200);
        res.end("OK");
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
if (CHANNEL_ID) {
  sendMessage(
    CHANNEL_ID,
    "🇸🇦 تم ربط بوت وظائف السعودية بالقناة بنجاح ✅"
  ).catch(console.error);
}
// مصادر الوظائف في السعودية
const JOB_SOURCES = [
  {
    name: "جدارات - وظائف حكومية وخاصة",
    url: "https://jadarat.sa"
  },
  {
    name: "لينكدإن - وظائف الشركات",
    url: "https://www.linkedin.com/jobs/"
  }
];

// الفاصل الزمني: 3 ساعات
const POST_INTERVAL = 3 * 60 * 60 * 1000;
// اختبار إرسال رسالة إلى قناة الوظائف
async function testJobPost() {
  if (!TOKEN || !CHANNEL_ID) {
    console.log("إعدادات البوت أو القناة غير مكتملة");
    return;
  }

  await sendMessage(
    CHANNEL_ID,
    "🇸🇦 بوت وظائف السعودية جاهز!\n\n" +
    "✅ سيتم نشر الوظائف الحكومية والخاصة هنا بعد تفعيل مصادر الوظائف."
  );
}
