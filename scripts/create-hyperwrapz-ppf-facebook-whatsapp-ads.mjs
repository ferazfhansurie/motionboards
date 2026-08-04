import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const VIDEO = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-30s-facebook-ad.mp4");
const POSTER = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-pricing-detailed-v4.png");
const THUMBNAIL = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-facebook-thumbnail.jpg");
const WA_LINK = "https://wa.me/601161884476";
const VIDEO_MESSAGE = [
  "Kereta sayang tapi takut cat cepat calar?",
  "PPF bantu protect paint daripada stone chips, scratches dan daily wear.",
  "Package start dari RM1,300.",
  "WhatsApp Hyperwrapz & Detailing sekarang untuk check package yang sesuai untuk kereta you.",
].join("\n\n");
const POSTER_MESSAGE = [
  "Nak jaga paint kereta?",
  "Check PPF packages kami:",
  "Full Front PPF + coating dari RM1,300\nFull Car PPF + coating RM3,300\natau Combo 3 in 1 RM4,400.",
  "WhatsApp Hyperwrapz & Detailing sekarang.",
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

async function main() {
  await loadEnv();
  if (!process.env.META_APP_TOKEN) throw new Error("META_APP_TOKEN missing");
  await Promise.all([fs.access(VIDEO), fs.access(POSTER), fs.access(THUMBNAIL)]);

  const campaign = await graph(`${ACCOUNT}/campaigns`, "POST", {
    name: "Hyperwrapz | PPF Packages | Facebook | WhatsApp Leads",
    objective: "OUTCOME_LEADS",
    buying_type: "AUCTION",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
    status: "PAUSED",
  });
  const adset = await graph(`${ACCOUNT}/adsets`, "POST", {
    name: "Klang Valley 45km | Car Owners | Facebook | WhatsApp Leads | RM30/day",
    campaign_id: campaign.id,
    daily_budget: 3000,
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
      ] }],
      targeting_automation: { advantage_audience: 0 },
      publisher_platforms: ["facebook"],
      facebook_positions: ["feed", "marketplace", "story", "facebook_reels"],
    },
    status: "PAUSED",
  });
  const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
  const [videoId, imageHash, thumbnailHash] = await Promise.all([
    uploadVideo(),
    uploadImage(POSTER, "image/png"),
    uploadImage(THUMBNAIL, "image/jpeg"),
  ]);
  const videoCreative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
    name: "PPF Video | Facebook | WhatsApp CTA",
    object_story_spec: { page_id: PAGE, video_data: {
      video_id: videoId,
      image_hash: thumbnailHash,
      title: "PPF Protection Packages",
      message: VIDEO_MESSAGE,
      call_to_action: cta,
    } },
  });
  const posterCreative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
    name: "PPF Pricing Poster | Facebook | WhatsApp CTA",
    object_story_spec: { page_id: PAGE, link_data: {
      image_hash: imageHash,
      link: WA_LINK,
      message: POSTER_MESSAGE,
      name: "PPF Protection Packages",
      call_to_action: cta,
    } },
  });
  const videoAd = await graph(`${ACCOUNT}/ads`, "POST", {
    name: "PPF Video | WhatsApp CTA",
    adset_id: adset.id,
    creative: { creative_id: videoCreative.id },
    status: "PAUSED",
  });
  const posterAd = await graph(`${ACCOUNT}/ads`, "POST", {
    name: "PPF Pricing Poster | WhatsApp CTA",
    adset_id: adset.id,
    creative: { creative_id: posterCreative.id },
    status: "PAUSED",
  });
  console.log(JSON.stringify({
    campaign: campaign.id,
    adset: adset.id,
    ads: { video: videoAd.id, poster: posterAd.id },
    status: "PAUSED",
    dailyBudgetMYR: 30,
    platforms: ["facebook"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
