import { promises as fs } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const IG = "17841448306375961";
const GRAPH = "https://graph.facebook.com/v23.0";
const VIDEO = path.join(ROOT, "IMG_5227.MOV");
const POSTERS = [
  { file: path.join(ROOT, "SG fathopes new Photos", "file_1784541964083_65a306f1f3d6.jpeg"), name: "PPF Protection", title: "Paint Protection Film", message: "Protect your car from scratches, chips and daily wear. WhatsApp Hyperwrapz & Detailing for PPF packages and availability." },
  { file: path.join(ROOT, "SG fathopes new Photos", "file_1784541971790_4d8fcfca8994.jpeg"), name: "Colour Wrapping", title: "Colour Change Wrap", message: "Tukar warna kereta tanpa cat semula. Choose from 3,000-plus colours and finishes at Hyperwrapz & Detailing. WhatsApp us for a consultation." },
  { file: path.join(ROOT, "SG fathopes new Photos", "file_1784542013674_d0af540cf869.jpeg"), name: "PPF Coating Tint", title: "PPF, Tint & Coating", message: "Protect what matters with premium tint, coating and PPF. WhatsApp Hyperwrapz & Detailing for the right package for your car." },
];

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
const token = () => process.env.META_APP_TOKEN;
async function graph(endpoint, method = "GET", body, authToken = token()) {
  const url = `${GRAPH}/${endpoint}`;
  const options = { method };
  if (body instanceof FormData) { body.set("access_token", authToken); options.body = body; }
  else if (body) { options.headers = { "Content-Type": "application/json" }; options.body = JSON.stringify({ ...body, access_token: authToken }); }
  else { const u = new URL(url); u.searchParams.set("access_token", authToken); return graphFetch(u, options); }
  return graphFetch(url, options);
}
async function graphFetch(url, options) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error(`${options.method || "GET"} ${url}: ${JSON.stringify(json.error || json)}`);
  return json;
}
async function uploadImage(file) {
  const form = new FormData();
  form.append("access_token", token());
  form.append("filename", new Blob([await fs.readFile(file)], { type: "image/jpeg" }), path.basename(file));
  const result = await graph(`${ACCOUNT}/adimages`, "POST", form);
  const first = Object.values(result.images || {})[0];
  if (!first?.hash) throw new Error(`No image hash returned for ${file}`);
  return first.hash;
}
async function uploadVideo(file) {
  const form = new FormData();
  form.append("access_token", token());
  form.append("source", new Blob([await fs.readFile(file)], { type: "video/quicktime" }), path.basename(file));
  const result = await graph(`${ACCOUNT}/videos`, "POST", form);
  if (!result.id) throw new Error("No Meta video ID returned");
  return result.id;
}
async function uploadPublicVideo(file) {
  const accountId = process.env.R2_ACCOUNT_ID.replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com.*$/, "").replace(/\/.*$/, "");
  const key = `hyperwrapz-ads/2026-07-20/${path.basename(file).replace(/\.MOV$/i, ".mp4")}`;
  const s3 = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, forcePathStyle: true });
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: await fs.readFile(file), ContentType: "video/quicktime", CacheControl: "public, max-age=31536000, immutable" }));
  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}
const CTA = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
async function main() {
  await loadEnv();
  if (!token()) throw new Error("META_APP_TOKEN missing");
  for (const file of [VIDEO, ...POSTERS.map((p) => p.file)]) await fs.access(file);
  const pages = await graph("me/accounts", "GET", null, token());
  const hyperwrapzPage = (pages.data || []).find((page) => page.id === PAGE);
  if (!hyperwrapzPage?.access_token) throw new Error("No Hyperwrapz Page access token returned by Meta");
  const pageToken = hyperwrapzPage.access_token;
  const caption = "Kereta lama tapi nak new look? Hyperwrapz & Detailing bantu upgrade look dan protect kereta korang. WhatsApp 011-6188 4476 untuk consultation. #Hyperwrapz #CarWrap #PPF #CarTint #CarDetailing";

  let facebookPost = null;
  console.log("Publishing Facebook Page video...");
  try {
    const fbForm = new FormData();
    fbForm.append("access_token", token());
    fbForm.append("source", new Blob([await fs.readFile(VIDEO)], { type: "video/quicktime" }), path.basename(VIDEO));
    fbForm.append("title", "Colour Change Wrap at Hyperwrapz & Detailing");
    fbForm.append("description", caption);
    facebookPost = await graph(`${PAGE}/videos`, "POST", fbForm, pageToken);
    console.log(`Facebook video post: ${facebookPost.id}`);
  } catch (error) { console.warn(`Facebook organic post skipped: ${error.message}`); }

  console.log("Publishing Instagram Reel...");
  const publicVideo = await uploadPublicVideo(VIDEO);
  let instagramPost = null;
  try {
    const igContainer = await graph(`${IG}/media`, "POST", { media_type: "REELS", video_url: publicVideo, caption });
    let status = "IN_PROGRESS";
    for (let i = 0; i < 30 && status === "IN_PROGRESS"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      const check = await graph(`${igContainer.id}?fields=status_code`);
      status = check.status_code;
      console.log(`Instagram Reel status: ${status}`);
    }
    if (status !== "FINISHED") throw new Error(`Instagram Reel processing ended with ${status}`);
    instagramPost = await graph(`${IG}/media`, "POST", { creation_id: igContainer.id });
    console.log(`Instagram Reel: ${instagramPost.id}`);
  } catch (error) { console.warn(`Instagram organic post skipped: ${error.message}`); }

  console.log("Creating paused Meta campaign with 1 video + 3 posters...");
  const campaign = await graph(`${ACCOUNT}/campaigns`, "POST", { name: "Hyperwrapz | Video + 3 Posters | WhatsApp Leads | 2026-07-20", objective: "OUTCOME_LEADS", buying_type: "AUCTION", daily_budget: 3000, is_adset_budget_sharing_enabled: false, bid_strategy: "LOWEST_COST_WITHOUT_CAP", special_ad_categories: [], status: "PAUSED" });
  const adset = await graph(`${ACCOUNT}/adsets`, "POST", { name: "Klang 40km | Car owners | WhatsApp | RM30/day", campaign_id: campaign.id, optimization_goal: "CONVERSATIONS", billing_event: "IMPRESSIONS", destination_type: "WHATSAPP", promoted_object: { page_id: PAGE }, targeting: { age_min: 18, age_max: 65, geo_locations: { custom_locations: [{ latitude: 3.0136, longitude: 101.4442, radius: 40, distance_unit: "kilometer" }], location_types: ["home", "recent"] }, publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed", "story", "facebook_reels", "marketplace"], instagram_positions: ["stream", "story", "reels", "explore", "profile_feed"] }, bid_strategy: "LOWEST_COST_WITHOUT_CAP", status: "PAUSED" });
  const ads = [];
  for (const poster of POSTERS) {
    const hash = await uploadImage(poster.file);
    const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", { name: `${poster.name} | Hyperwrapz | WhatsApp`, object_story_spec: { page_id: PAGE, instagram_user_id: IG, link_data: { image_hash: hash, message: poster.message, name: poster.title, link: "https://wa.me/601161884476", call_to_action: CTA } } });
    const ad = await graph(`${ACCOUNT}/ads`, "POST", { name: `Poster | ${poster.name}`, adset_id: adset.id, creative: { creative_id: creative.id }, status: "PAUSED" });
    ads.push({ type: "poster", name: poster.name, ad_id: ad.id });
  }
  const videoId = await uploadVideo(VIDEO);
  const videoCreative = await graph(`${ACCOUNT}/adcreatives`, "POST", { name: "Video | Colour Wrap | Hyperwrapz | WhatsApp", object_story_spec: { page_id: PAGE, instagram_user_id: IG, video_data: { video_id: videoId, title: "Colour Change Wrap", message: caption, call_to_action: CTA } } });
  const videoAd = await graph(`${ACCOUNT}/ads`, "POST", { name: "Video | Colour Wrap", adset_id: adset.id, creative: { creative_id: videoCreative.id }, status: "PAUSED" });
  ads.push({ type: "video", ad_id: videoAd.id, video_id: videoId });
  console.log(JSON.stringify({ facebook_post: facebookPost?.id || null, instagram_post: instagramPost?.id || null, campaign: campaign.id, adset: adset.id, ads, status: "PAUSED" }, null, 2));
}
main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
