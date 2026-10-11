
const http = require("http");
const fs = require("fs");
const path = require("path");
const { formatJob } = require("./jobs");

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SECRET = process.env.PUBLISH_SECRET;

const DATA = path.join(__dirname, "jobs-data.json");
const HISTORY = path.join(__dirname, "posted-jobs.json");

let publishing = false;

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function sendMessage(chatId, text) {
  if (!TOKEN || !chatId) {
    throw new Error("Missing Telegram configuration");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram error: ${result.description || response.status}`
    );
  }

  return result;
}

async function publishJobs() {
  if (publishing) {
    throw new Error("Publishing already running");
  }

  publishing = true;

  try {
    const data = readJSON(DATA, { jobs: [] });
    const history = readJSON(HISTORY, { posted: [] });

    const posted = new Set(
      Array.isArray(history.posted) ? history.posted : []
    );

    let sent = 0;

    for (const job of data.jobs || []) {
      const id = String(job.url || "").trim();

      if (!id || posted.has(id)) continue;

      const message = formatJob(job);

      if (!message) continue;

      await sendMessage(CHANNEL_ID, message);

      posted.add(id);

      fs.writeFileSync(
        HISTORY,
        JSON.stringify({ posted: [...posted] }, null, 2)
      );

      sent++;
    }

    console.log(`Publishing complete. Sent: ${sent}`);
    return sent;
  } finally {
    publishing = false;
  }
}

const server = http.createServer(async (req, res) => {
  const reply = (code, message) => {
    res.writeHead(code, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.end(message);
  };

  if (req.method === "GET" && req.url === "/") {
    return reply(200, "Saudi Jobs Bot is running!");
  }

  if (req.method === "POST" && req.url === "/publish") {
    if (
      !SECRET ||
      req.headers["x-publish-secret"] !== SECRET
    ) {
      return reply(401, "Unauthorized");
    }

    try {
      const count = await publishJobs();
      return reply(
        200,
        `Publishing completed. Sent: ${count}`
      );
    } catch (error) {
      console.error("Publish failed:", error);
      return reply(500, "Publishing failed");
    }
  }

  return reply(404, "Not found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
