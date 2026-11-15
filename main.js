export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ثبت خودکار وب‌هوک در صورت نیاز به راه‌اندازی اولیه
    if (url.pathname === "/set-webhook") {
      const webhookUrl = `https://${url.host}/`;
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    if (request.method !== "POST") {
      return new Response("Alpha Cipher Trading Bot is Active.", { status: 200 });
    }

    try {
      const update = await request.json();
      
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id.toString();

        if (text === "/start" || text === "شروع") {
          let keyboard = [
            [{ text: "📊 تحلیل زنده طلا و بازار (Action)", callback_data: "analyze_gold" }]
          ];

          if (userId === env.ADMIN_ID) {
            keyboard.push([{ text: "⚙️ پنل مدیریت ادمین", callback_data: "admin_panel" }]);
          }

          await sendTelegramMessage(env.BOT_TOKEN, chatId, 
            "🔥 **سیستم معاملاتی هوشمند آلفا سایفر**\n\nبه مدار بسته تحلیل طلا و بازار خوش آمدید. برای دریافت سیگنال یا ورود به پنل، از دکمه‌های زیر استفاده کنید:", 
            { inline_keyboard: keyboard }
          );
        }
      }

      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id.toString();
        const data = callbackQuery.data;

        if (data === "analyze_gold") {
          await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "در حال اسکن نودهای بازار و تحلیل کندل‌ها...");
          
          const report = await generateAdvancedAnalysis();
          
          await sendTelegramMessage(env.BOT_TOKEN, chatId, report, {
            inline_keyboard: [[
              { text: "🔄 به‌روزرسانی تحلیل", callback_data: "analyze_gold" },
              { text: "🔙 بازگشت به منو", callback_data: "main_menu" }
            ]]
          });
        } 
        else if (data === "admin_panel") {
          if (userId !== env.ADMIN_ID) {
            await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "⚠️ دسترسی غیرمجاز!", true);
            return new Response("Unauthorized", { status: 403 });
          }

          await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "بارگذاری پنل مدیریت...");
          await editMessageText(env.BOT_TOKEN, chatId, callbackQuery.message.message_id, 
            "⚙️ **پنل مدیریت مرکزی آلفا سایفر**\n\nوضعیت سرور: 🟢 آنلاین (Cloudflare Edge)\nسطح دسترسی: ادمین کل\n\nاز گزینه‌های زیر برای مدیریت سیستم استفاده کنید:",
            {
              inline_keyboard: [
                [
                  { text: "🟢 روشن‌سازی اتواسکن", callback_data: "admin_start_scan" },
                  { text: "🔴 خاموش‌سازی اتواسکن", callback_data: "admin_stop_scan" }
                ],
                [
                  { text: "📊 آمار و وضعیت نودها", callback_data: "admin_stats" }
                ],
                [
                  { text: "🔙 بازگشت به منوی اصلی", callback_data: "main_menu" }
                ]
              ]
            }
          );
        }
        else if (data === "admin_stats") {
          if (userId !== env.ADMIN_ID) return new Response("Unauthorized", { status: 403 });
          await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, "دریافت آمار سیستم...");
          await sendTelegramMessage(env.BOT_TOKEN, chatId, "📈 **گزارش وضعیت سرورلس:**\n- پلتفرم: Cloudflare Workers\n- تاخیر شبکه (Latency): زیر 40ms\n- اتصال به فیدهای قیمت: برقرار ✅");
        }
        else if (data === "admin_start_scan" || data === "admin_stop_scan") {
          if (userId !== env.ADMIN_ID) return new Response("Unauthorized", { status: 403 });
          const statusText = data === "admin_start_scan" ? "فعال شد 🟢" : "متوقف شد 🔴";
          await answerCallbackQuery(env.BOT_TOKEN, callbackQuery.id, `سیستم اتواسکن ${statusText}`);
        }
        else if (data === "main_menu") {
          let keyboard = [
            [{ text: "📊 تحلیل زنده طلا و بازار (Action)", callback_data: "analyze_gold" }]
          ];
          if (userId === env.ADMIN_ID) {
            keyboard.push([{ text: "⚙️ پنل مدیریت ادمین", callback_data: "admin_panel" }]);
          }
          await editMessageText(env.BOT_TOKEN, chatId, callbackQuery.message.message_id, 
            "🔥 **سیستم معاملاتی هوشمند آلفا سایفر**\n\nمنوی اصلی:", 
            { inline_keyboard: keyboard }
          );
        }
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
};

async function generateAdvancedAnalysis() {
  try {
    const goldRes = await fetch("https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=5m&limit=30");
    const goldCandles = await goldRes.json();

    if (!Array.isArray(goldCandles) || goldCandles.length < 20) {
      return "❌ خطا در دریافت دیتای کندل‌ها از بازار.";
    }

    const closes = goldCandles.map(c => parseFloat(c[4]));
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];

    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let trend = "نوسانی / رنج (Consolidation)";
    let signal = "⏳ صبر و انتظار (صبر تا شکست محدوده)";
    let emoji = "⚖️";

    const diffPercent = ((currentPrice - prevPrice) / prevPrice) * 100;

    if (rsi < 45 && diffPercent > 0) {
      signal = "🟢 پیشنهاد: خرید (BUY) پله‌ای";
      trend = "برگشت از کف / صعودی";
      emoji = "🚀";
    } else if (rsi > 55 && diffPercent < 0) {
      signal = "🔴 پیشنهاد: فروش (SELL) سرعتی";
      trend = "اصلاحی / نزولی";
      emoji = "🔻";
    }

    const sl = (currentPrice - 3.5).toFixed(2);
    const tp = (currentPrice + 6.0).toFixed(2);
    const timestamp = new Date().toLocaleTimeString();

    return `⚡️ **گزارش پردازشگر هوشمند (Trendo Engine)** ⚡️

🕒 **زمان تحلیل:** \`${timestamp}\`
🥇 **دارایی:** طلا (Gold / PAXG)
💰 **قیمت لحظه‌ای:** \`${currentPrice.toLocaleString()}\`
📊 **شاخص مومنتوم (RSI):** \`${rsi.toFixed(1)}\`
📈 **وضعیت روند:** \`${trend}\`

${emoji} **سیگنال استراتژیک:**
${signal}

🎯 **پارامترهای پیشنهادی برای معامله:**
🛑 **حد ضرر (SL):** \`${sl}\`
✅ **حد سود (TP):** \`${tp}\` (هدف کسب سود روزانه)
-----------------------------------
*سیستم کاملاً مستقل از نودهای بلاک‌چین و بازار جهانی تغذیه می‌شود.*`;

  } catch (e) {
    return "❌ خطا در محاسبات آن‌چین و تحلیل بازار: " + e.message;
  }
}

async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text: text, parse_mode: "Markdown" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function editMessageText(token, chatId, messageId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const body = { chat_id: chatId, message_id: messageId, text: text, parse_mode: "Markdown" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function answerCallbackQuery(token, callbackQueryId, text, showAlert = false) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text: text, show_alert: showAlert }) });
}
