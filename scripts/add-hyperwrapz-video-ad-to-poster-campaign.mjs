import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const ADSET_ID = "52549769618548"; // the "lots of posters" HyperWrapz campaign's ad set

const SC = "/private/tmp/claude-501/-Users-faeez-motionboards/9a45d38a-94db-4d02-9904-4e90fbc57221/scratchpad";
const VIDEO = path.join(SC, "ppf_video_ad_original.mp4");
const THUMB = path.join(SC, "ppf_video_thumb_original.jpg");

const MESSAGE = [
  "Kereta baru, tapi risau kena calar dalam bulan pertama?",
  "Cat yang calar boleh jejaskan nilai kereta anda - dan selalunya kita tak perasan sampai dah terlambat. Dengan Full Car PPF 8.5mil, cat kereta anda kekal licin dan terlindung daripada calar halus, kesan batu jalan dan cuaca.",
  "Full Car PPF 8.5mil dari RM3,300. Promo Merdeka terhad bulan ini.",
  "Hyperwrapz & Detailing - 19 tahun dalam industri automotive protection di Klang.",
  "WhatsApp Hyperwrapz & Detailing sekarang untuk book slot anda.",
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

async function uploadImage(file) {
  const form = new FormData();
  form.append("filename", new Blob([await fs.readFile(file)], { type: "image/jpeg" }), path.basename(file));
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

  const adset = await graph(`${ADSET_ID}?fields=name,campaign_id,status`, "GET");
  console.log("target adset:", JSON.stringify(adset));

  console.log("uploading video...");
  const videoId = await uploadVideo();
  console.log("video id:", videoId);
  await waitForVideoReady(videoId);

  const thumbHash = await uploadImage(THUMB);

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
  console.log("creative:", creative.id);

  const ad = await graph(`${ACCOUNT}/ads`, "POST", {
    name: "PPF Real Presenter Video | WhatsApp CTA",
    adset_id: ADSET_ID,
    creative: { creative_id: creative.id },
    status: "ACTIVE",
  });
  console.log("new ad:", JSON.stringify(ad));

  console.log(JSON.stringify({ adset: ADSET_ID, newAd: ad.id, creative: creative.id, videoId }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
