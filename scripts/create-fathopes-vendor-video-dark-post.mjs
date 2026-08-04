import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_PATH = path.join(ROOT, "FatHopes IMG", "push-commission", "IMG_5284.MOV");

const GRAPH = "https://graph.facebook.com/v23.0";
const ACCOUNT_ID = "725484841474739";
const CAMPAIGN_ID = "120250334404620294";
const ADSET_ID = "120250334466610294";
const PAGE_ID = "102967319775538";
const VENDOR_LINK = "https://www.fathopesenergy.com/vendor-app/";
const AD_NAME = "Vendor Video - Push Commission (Clicks)";
const COPY = "Minyak masak terpakai? Kami kutip terus dari kedai korang dan korang dibayar.\n\nDaftar jadi vendor FatHopes Energy hari ni.\n\nIsi borang, kami hubungi korang.";

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

let TOKEN;
async function get(edge, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: TOKEN });
  const response = await fetch(`${GRAPH}/${edge}?${query}`);
  const json = await response.json();
  if (!response.ok) throw new Error(`GET ${edge}: ${JSON.stringify(json)}`);
  return json;
}
async function post(edge, body) {
  const response = await fetch(`${GRAPH}/${edge}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`POST ${edge}: ${JSON.stringify(json)}`);
  return json;
}
async function postForm(edge, form) {
  form.append("access_token", TOKEN);
  const response = await fetch(`${GRAPH}/${edge}`, { method: "POST", body: form });
  const json = await response.json();
  if (!response.ok) throw new Error(`POST(form) ${edge}: ${JSON.stringify(json)}`);
  return json;
}

async function uploadVideo() {
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(VIDEO_PATH)], { type: "video/quicktime" }), "IMG_5284.MOV");
  form.append("name", "FatHopes Vendor Push Commission");
  return (await postForm(`act_${ACCOUNT_ID}/advideos`, form)).id;
}

async function waitForVideo(videoId) {
  for (;;) {
    const video = await get(videoId, { fields: "status" });
    const status = video.status?.video_status;
    console.log(`Video status: ${status}`);
    if (status === "ready") return;
    if (status === "error") throw new Error(`Meta video processing failed: ${JSON.stringify(video)}`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function thumbnail(videoId) {
  const result = await get(`${videoId}/thumbnails`, { fields: "uri,is_preferred" });
  return (result.data.find((item) => item.is_preferred) || result.data[0])?.uri;
}

async function main() {
  await loadEnv();
  TOKEN = process.env.META_APP_TOKEN;
  if (!TOKEN) throw new Error("META_APP_TOKEN is missing from env.local");
  await fs.access(VIDEO_PATH);

  const existing = await get(`act_${ACCOUNT_ID}/ads`, { fields: "id,name,status,adset", filtering: JSON.stringify([{ field: "ad.name", operator: "EQUAL", value: AD_NAME }]) });
  const duplicate = existing.data?.find((ad) => ad.name === AD_NAME && ad.adset?.id === ADSET_ID);
  if (duplicate) throw new Error(`An ad with this name already exists in the target ad set: ${duplicate.id}`);

  console.log(`Uploading ${VIDEO_PATH}`);
  const videoId = await uploadVideo();
  console.log(`Video ID: ${videoId}`);
  await waitForVideo(videoId);
  const imageUrl = await thumbnail(videoId);

  const creative = await post(`act_${ACCOUNT_ID}/adcreatives`, {
    name: `${AD_NAME} Creative`,
    object_story_spec: {
      page_id: PAGE_ID,
      video_data: {
        video_id: videoId,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        title: "Daftar Jadi Vendor",
        message: COPY,
        call_to_action: { type: "SEE_DETAILS", value: { link: VENDOR_LINK } },
      },
    },
  });

  const ad = await post(`act_${ACCOUNT_ID}/ads`, {
    name: AD_NAME,
    adset_id: ADSET_ID,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  const verified = await get(ad.id, { fields: "id,name,status,effective_status,adset,campaign,creative" });
  console.log(JSON.stringify({ campaign_id: CAMPAIGN_ID, adset_id: ADSET_ID, video_id: videoId, creative_id: creative.id, ad: verified }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
