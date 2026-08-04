import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const VIDEO = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-30s-facebook-ad.mp4");
const POSTER = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-pricing-detailed-v4.png");
const VIDEO_CAPTION = "Kereta sayang tapi takut cat cepat calar? PPF bantu protect paint daripada stone chips, scratches dan daily wear. Package start dari RM1,300. WhatsApp Hyperwrapz & Detailing sekarang untuk check package yang sesuai untuk kereta you.";
const POSTER_CAPTION = "Nak jaga paint kereta? Check PPF packages kami: Full Front PPF + coating dari RM1,300, Full Car PPF + coating RM3,300, atau Combo 3 in 1 RM4,400. WhatsApp Hyperwrapz & Detailing sekarang.";

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const token = () => process.env.META_APP_TOKEN;

async function graph(endpoint, method = "GET", body, authToken = token()) {
  const url = new URL(`${GRAPH}/${endpoint}`);
  const options = { method };
  if (body instanceof FormData) {
    body.set("access_token", authToken);
    options.body = body;
  } else if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify({ ...body, access_token: authToken });
  } else {
    url.searchParams.set("access_token", authToken);
  }
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function pageToken() {
  const pages = await graph("me/accounts?fields=id,name,access_token");
  const page = pages.data?.find((item) => item.id === PAGE);
  if (!page?.access_token) throw new Error("Hyperwrapz & Detailing Facebook Page access is unavailable");
  return page.access_token;
}

async function postIdForMedia(mediaId, message, pageAccessToken) {
  const media = await graph(`${mediaId}?fields=id,permalink_url`, "GET", undefined, pageAccessToken);
  if (media.id?.startsWith(`${PAGE}_`)) return { postId: media.id, permalink: media.permalink_url || null };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const feed = await graph(`${PAGE}/feed?fields=id,message,permalink_url,created_time&limit=25`, "GET", undefined, pageAccessToken);
    const post = feed.data?.find((item) => item.message === message);
    if (post) return { postId: post.id, permalink: post.permalink_url || null };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Facebook published media ${mediaId}, but its Page post could not be resolved`);
}

async function publishVideo(pageAccessToken) {
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(VIDEO)], { type: "video/mp4" }), path.basename(VIDEO));
  form.append("title", "PPF Protection Packages | Hyperwrapz & Detailing");
  form.append("description", VIDEO_CAPTION);
  const video = await graph(`${PAGE}/videos`, "POST", form, pageAccessToken);
  return postIdForMedia(video.id, VIDEO_CAPTION, pageAccessToken);
}

async function publishPoster(pageAccessToken) {
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(POSTER)], { type: "image/png" }), path.basename(POSTER));
  form.append("caption", POSTER_CAPTION);
  const photo = await graph(`${PAGE}/photos`, "POST", form, pageAccessToken);
  return postIdForMedia(photo.id, POSTER_CAPTION, pageAccessToken);
}

async function main() {
  await loadEnv();
  if (!token()) throw new Error("META_APP_TOKEN is missing");
  await fs.access(VIDEO);
  await fs.access(POSTER);
  const accessToken = await pageToken();
  const whatsappLeads = process.env.HYPERWRAPZ_USE_WHATSAPP_LEADS === "1";
  const campaignName = whatsappLeads
    ? "Hyperwrapz | PPF Packages | Facebook | WhatsApp Leads | Existing Posts"
    : "Hyperwrapz | PPF Packages | Facebook | Existing Posts";

  const videoPost = process.env.HYPERWRAPZ_VIDEO_POST_ID
    ? { postId: process.env.HYPERWRAPZ_VIDEO_POST_ID, permalink: process.env.HYPERWRAPZ_VIDEO_POST_URL || null }
    : await publishVideo(accessToken);
  const posterPost = process.env.HYPERWRAPZ_POSTER_POST_ID
    ? { postId: process.env.HYPERWRAPZ_POSTER_POST_ID, permalink: process.env.HYPERWRAPZ_POSTER_POST_URL || null }
    : await publishPoster(accessToken);

  console.log("Creating a Facebook-only paused PPF existing-post campaign...");
  const campaign = await graph(`${ACCOUNT}/campaigns`, "POST", {
    name: campaignName,
    objective: whatsappLeads ? "OUTCOME_LEADS" : "OUTCOME_ENGAGEMENT",
    buying_type: "AUCTION",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
    status: "PAUSED",
  });
  const adset = await graph(`${ACCOUNT}/adsets`, "POST", {
    name: whatsappLeads
      ? "Klang Valley 45km | Car Owners | Facebook | WhatsApp Leads | RM30/day"
      : "Klang Valley 45km | Car Owners | Facebook | Post Engagement | RM30/day",
    campaign_id: campaign.id,
    daily_budget: 3000,
    billing_event: "IMPRESSIONS",
    optimization_goal: whatsappLeads ? "CONVERSATIONS" : "POST_ENGAGEMENT",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: whatsappLeads ? "WHATSAPP" : "ON_POST",
    promoted_object: { page_id: PAGE, smart_pse_enabled: false },
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

  const createExistingPostAd = async (name, postId) => {
    const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
      name: `${name} | Existing Facebook Page Post`,
      object_story_id: postId,
      ...(whatsappLeads ? { call_to_action_type: "WHATSAPP_MESSAGE" } : {}),
    });
    const ad = await graph(`${ACCOUNT}/ads`, "POST", {
      name,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    return { adId: ad.id, creativeId: creative.id, postId };
  };

  const videoAd = await createExistingPostAd("PPF Video | Existing Facebook Post", videoPost.postId);
  const posterAd = await createExistingPostAd("PPF Pricing Poster | Existing Facebook Post", posterPost.postId);
  console.log(JSON.stringify({
    status: "PAUSED",
    campaign: { id: campaign.id, name: campaignName },
    adset: { id: adset.id, dailyBudgetMYR: 30, platforms: ["facebook"] },
    posts: { video: videoPost, poster: posterPost },
    ads: { video: videoAd, poster: posterAd },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
