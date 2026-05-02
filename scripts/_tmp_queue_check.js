// Sanity check: can the api process reach the wwebjs queue?
require("dotenv").config();
const q = require('./src/services/messaging/queue');
(async () => {
  console.log("addWwebjsMessage type:", typeof q.addWwebjsMessage);
  console.log("queue names:", Object.keys(q.QUEUE_NAMES || {}));
  try {
    const h = await q.healthCheck();
    console.log("redis health:", JSON.stringify(h));
    const stats = await q.getQueueStats('wwebjs').catch(() => null);
    if (stats) console.log("wwebjs queue stats:", JSON.stringify(stats));
  } catch (e) {
    console.error("health check err:", e.message);
  }
  process.exit(0);
})();
