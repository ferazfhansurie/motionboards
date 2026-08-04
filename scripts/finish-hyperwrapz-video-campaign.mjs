import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const IG = "17841448306375961";
const CAMPAIGN = "52546489843948";
const ADSET = "52546489849548";
const GRAPH = "https://graph.facebook.com/v23.0";
const VIDEO = path.join(ROOT, "IMG_5227.MOV");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const userToken = () => process.env.META_APP_TOKEN;
async function graph(endpoint, method = "GET", body, auth = userToken()) {
  const url = `${GRAPH}/${endpoint}`;
  const opts = { method };
  if (body instanceof FormData) { body.set("access_token", auth); opts.body = body; }
  else if (body) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify({ ...body, access_token: auth }); }
  else { const u = new URL(url); u.searchParams.set("access_token", auth); return graphFetch(u, opts); }
  return graphFetch(url, opts);
}
async function graphFetch(url, opts) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${opts.method} ${url}: ${JSON.stringify(json.error || json)}`);
  return json;
}
async function uploadAdVideo(pageToken) {
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(VIDEO)], { type: "video/quicktime" }), path.basename(VIDEO));
  return graph(`${ACCOUNT}/advideos`, "POST", form, pageToken);
}
async function main() {
  await loadEnv();
  const pages = await graph("me/accounts", "GET");
  const page = (pages.data || []).find((item) => item.id === PAGE);
  if (!page?.access_token) throw new Error("No Hyperwrapz Page access token");
  const pageToken = page.access_token;
  const publicVideo = `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/hyperwrapz-ads/2026-07-20/IMG_5227.mp4`;
  const caption = "Kereta lama tapi nak new look? Hyperwrapz & Detailing bantu upgrade look dan protect kereta korang. WhatsApp 011-6188 4476 untuk consultation. #Hyperwrapz #CarWrap #PPF #CarTint #CarDetailing";

  console.log("Publishing Instagram Reel...");
  const container = await graph(`${IG}/media`, "POST", { media_type: "REELS", video_url: publicVideo, caption });
  let status = "IN_PROGRESS";
  for (let i = 0; i < 30 && status === "IN_PROGRESS"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    status = (await graph(`${container.id}?fields=status_code`)).status_code;
    console.log(`Instagram status: ${status}`);
  }
  if (status !== "FINISHED") throw new Error(`Instagram processing ended with ${status}`);
  const igPost = await graph(`${IG}/media_publish`, "POST", { creation_id: container.id });
  console.log(`Instagram Reel published: ${igPost.id}`);

  console.log("Uploading video creative to the existing paused campaign...");
  const uploaded = await uploadAdVideo(pageToken);
  const videoId = uploaded.id || uploaded.video_id;
  if (!videoId) throw new Error(`No ad video ID: ${JSON.stringify(uploaded)}`);
  const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
  const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", { name: "Video | Colour Wrap | Hyperwrapz | WhatsApp", object_story_spec: { page_id: PAGE, instagram_user_id: IG, video_data: { video_id: videoId, title: "Colour Change Wrap", message: caption, call_to_action: cta } } });
  const ad = await graph(`${ACCOUNT}/ads`, "POST", { name: "Video | Colour Wrap", adset_id: ADSET, creative: { creative_id: creative.id }, status: "PAUSED" });
  console.log(JSON.stringify({ instagram_post: igPost.id, campaign: CAMPAIGN, adset: ADSET, video_ad: ad.id, video_id: videoId, status: "PAUSED" }, null, 2));
}
main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
