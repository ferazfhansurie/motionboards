import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const WA_LINK = "https://wa.me/601161884476";

const SC = "/private/tmp/claude-501/-Users-faeez-motionboards/9a45d38a-94db-4d02-9904-4e90fbc57221/scratchpad";
const VIDEO = path.join(SC, "ppf_video_ad.mp4");
const THUMB = path.join(SC, "ppf_video_thumb.jpg");

const MESSAGE = [
  "Jangan sampai dia tercalar guys!",
  "Full Car PPF 8.5mil - self-healing, invisible protection untuk cat kereta anda.",
  "WhatsApp Hyperwrapz & Detailing sekarang untuk quotation.",
].join("\n\n");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function graph(endpoint, method = "GET", body) {
  const url = new URL(`${GRAPH}/${endpoint}`);
  const options = { method };
  if (body instanceof FormData) {
    body.set("access_token", process.env.META_APP_TOKEN);
    options.body = body;
  } else if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify({ ...body, access_token: process.env.META_APP_TOKEN });
  } else {
    url.searchParams.set("access_token", process.env.META_APP_TOKEN);
  }
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function uploadVideo() {
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(VIDEO)], { type: "video/mp4" }), path.basename(VIDEO));
  const result = await graph(`${ACCOUNT}/advideos`, "POST", form);
  if (!result.id) throw new Error("Meta did not return a video ID");
  return result.id;
}

async function uploadImage(file, mimeType) {
  const form = new FormData();
  form.append("filename", new Blob([await fs.readFile(file)], { type: mimeType }), path.basename(file));
  const result = await graph(`${ACCOUNT}/adimages`, "POST", form);
  const image = Object.values(result.images || {})[0];
  if (!image?.hash) throw new Error("Meta did not return an image hash");
  return image.hash;
}

async function waitForVideoReady(videoId) {
  for (let i = 0; i < 40; i++) {
    const v = await graph(`${videoId}?fields=status`, "GET");
    const state = v.status?.video_status;
    console.log(`video ${videoId} status: ${state}`);
    if (state === "ready") return;
    if (state === "error") throw new Error(`video processing failed: ${JSON.stringify(v.status)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("video did not become ready in time");
}

async function main() {
  await loadEnv();
  if (!process.env.META_APP_TOKEN) throw new Error("META_APP_TOKEN missing");
  await Promise.all([fs.access(VIDEO), fs.access(THUMB)]);

  const campaign = await graph(`${ACCOUNT}/campaigns`, "POST", {
    name: "Hyperwrapz | PPF Video (Real Presenter) | Facebook | WhatsApp Leads | 2026-08-01",
    objective: "OUTCOME_LEADS",
    buying_type: "AUCTION",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
    status: "PAUSED",
  });

  const adset = await graph(`${ACCOUNT}/adsets`, "POST", {
    name: "Klang Valley 45km | Car Owners | Facebook | WhatsApp Leads | RM60/day",
    campaign_id: campaign.id,
    daily_budget: 6000,
    billing_event: "IMPRESSIONS",
    optimization_goal: "CONVERSATIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "WHATSAPP",
    promoted_object: { page_id: PAGE },
    targeting: {
      age_min: 25,
      age_max: 65,
      geo_locations: { cities: [{ key: "1573488", radius: 45, distance_unit: "kilometer" }] },
      flexible_spec: [{ interests: [
        { id: "6003108301233", name: "Auto detailing (vehicles)" },
        { id: "6003717190262", name: "Car club" },
        { id: "6003641420907", name: "Automotive design" },
        { id: "6003428134689", name: "Aftermarket (automotive)" },
        { id: "6003422596441", name: "Service (motor vehicle)" },
        { id: "6003346992274", name: "car wash (vehicle parts and services)" },
      ] }],
      targeting_automation: { advantage_audience: 0 },
      publisher_platforms: ["facebook"],
      facebook_positions: ["feed", "marketplace", "story", "facebook_reels"],
    },
    status: "PAUSED",
  });

  console.log("uploading video...");
  const videoId = await uploadVideo();
  console.log("video id:", videoId);
  await waitForVideoReady(videoId);

  const thumbHash = await uploadImage(THUMB, "image/jpeg");

  const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
  const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
    name: "PPF Real Presenter Video | Facebook | WhatsApp CTA",
    object_story_spec: { page_id: PAGE, video_data: {
      video_id: videoId,
      image_hash: thumbHash,
      title: "Full Car PPF 8.5mil",
      message: MESSAGE,
      call_to_action: cta,
    } },
  });

  const ad = await graph(`${ACCOUNT}/ads`, "POST", {
    name: "PPF Real Presenter Video | WhatsApp CTA",
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  console.log(JSON.stringify({
    campaign: campaign.id,
    adset: adset.id,
    ad: ad.id,
    creative: creative.id,
    videoId,
    status: "PAUSED",
    dailyBudgetMYR: 60,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
