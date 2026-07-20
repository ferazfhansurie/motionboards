import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACT = "act_3681677928638351";
const PAGE = "121551227591222";
const IG = "17841448306375961";
const V = "v21.0";
const OUT = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "video-clips");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const token = () => process.env.META_APP_TOKEN;

async function api(endpoint, method = "GET", body) {
  const url = `https://graph.facebook.com/${V}/${endpoint}`;
  const opts = { method };
  if (body instanceof FormData) opts.body = body;
  else if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function uploadImage(file) {
  const form = new FormData();
  form.append("access_token", token());
  form.append("filename", new Blob([await fs.readFile(file)], { type: "image/jpeg" }), path.basename(file));
  const result = await api(`${ACT}/adimages`, "POST", form);
  const first = Object.values(result.images || {})[0];
  if (!first?.hash) throw new Error(`No image hash returned for ${file}`);
  return first.hash;
}

async function uploadVideo(file) {
  const form = new FormData();
  form.append("access_token", token());
  form.append("source", new Blob([await fs.readFile(file)], { type: "video/quicktime" }), path.basename(file));
  const result = await api(`${ACT}/videos`, "POST", form);
  if (!result.id) throw new Error(`No video id returned for ${file}`);
  return result.id;
}

const CTA = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
const ads = [
  {
    name: "Colour Wrap - Hyperwrapz",
    image: path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "infographic", "colour-wrap-v4.png"),
    message: "Nak tukar colour kereta tanpa cat balik? Colour wrap bagi look baru dan protect cat asal. Ada banyak pilihan colour, finish matte, satin, gloss sampai chrome. WhatsApp Hyperwrapz & Detailing untuk check harga kereta korang.",
    title: "Colour Wrap untuk kereta korang",
  },
  {
    name: "PPF & Coating - Hyperwrapz",
    image: path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "infographic", "ppf-coating-v3.png"),
    message: "Nak protect paint kereta? Hyperwrapz & Detailing buat PPF dan coating dengan installation professional. WhatsApp kami untuk tengok package yang sesuai dengan kereta korang.",
    title: "Protect paint kereta korang",
  },
  {
    name: "Tinting - Hyperwrapz",
    image: path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "infographic", "tinting-v2.png"),
    message: "Kereta panas dan silau? Tengok pilihan tinting dari Hyperwrapz & Detailing. WhatsApp kami untuk check spec dan harga ikut kereta korang.",
    title: "Professional car tinting",
  },
];

async function main() {
  await loadEnv();
  if (!token()) throw new Error("META_APP_TOKEN is missing");
  const campaign = await api(`${ACT}/campaigns`, "POST", {
    name: "Hyperwrapz & Detailing - WhatsApp Leads - Jalan Ramin 40km",
    objective: "OUTCOME_LEADS",
    buying_type: "AUCTION",
    daily_budget: 3000,
    is_adset_budget_sharing_enabled: false,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    special_ad_categories: [],
    status: "PAUSED",
    access_token: token(),
  });
  console.log(`campaign=${campaign.id}`);
  const adset = await api(`${ACT}/adsets`, "POST", {
    name: "Jalan Ramin 3/KS7 +40km - WhatsApp",
    campaign_id: campaign.id,
    optimization_goal: "CONVERSATIONS",
    billing_event: "IMPRESSIONS",
    destination_type: "WHATSAPP",
    promoted_object: { page_id: PAGE },
    targeting: {
      age_min: 18,
      age_max: 65,
      geo_locations: { custom_locations: [{ latitude: 3.0136, longitude: 101.4442, radius: 40, distance_unit: "kilometer" }], location_types: ["home", "recent"] },
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "story", "facebook_reels", "marketplace"],
      instagram_positions: ["stream", "story", "reels", "explore", "profile_feed"],
    },
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
    access_token: token(),
  });
  console.log(`adset=${adset.id}`);
  for (const ad of ads) {
    const hash = await uploadImage(ad.image);
    const creative = await api(`${ACT}/adcreatives`, "POST", {
      name: `${ad.name} | WhatsApp`,
      object_story_spec: { page_id: PAGE, instagram_user_id: IG, link_data: { image_hash: hash, message: ad.message, name: ad.title, link: "https://wa.me/", call_to_action: CTA } },
      access_token: token(),
    });
    const created = await api(`${ACT}/ads`, "POST", { name: `WA | ${ad.name}`, adset_id: adset.id, creative: { creative_id: creative.id }, status: "PAUSED", access_token: token() });
    console.log(`ad=${created.id} name=${ad.name}`);
  }
  const videoFile = path.join(ROOT, "Hyperwrapz & Detailing", "IMG_5206.MOV");
  const videoId = await uploadVideo(videoFile);
  const videoCreative = await api(`${ACT}/adcreatives`, "POST", {
    name: "Kid Colour Wrap Video | WhatsApp",
    object_story_spec: { page_id: PAGE, instagram_user_id: IG, video_data: { video_id: videoId, title: "Colour wrap tanpa cat balik", message: "Ni namanya colour change wrap — tukar warna kereta tanpa kena cat balik. Nak tau harga untuk kereta korang? WhatsApp Hyperwrapz & Detailing.", call_to_action: CTA } },
    access_token: token(),
  });
  const videoAd = await api(`${ACT}/ads`, "POST", { name: "WA | Kid Colour Wrap Video", adset_id: adset.id, creative: { creative_id: videoCreative.id }, status: "PAUSED", access_token: token() });
  console.log(`video=${videoId} ad=${videoAd.id}`);
  console.log(`ACTIVATE campaign ${campaign.id} adset ${adset.id}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
