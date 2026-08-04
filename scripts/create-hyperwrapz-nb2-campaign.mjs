import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const WA_LINK = "https://wa.me/601161884476";

const HW = path.join(ROOT, "Hyperwrapz & Detailing", "_gen");
const CREATIVES = [
  {
    key: "reveal",
    file: path.join(HW, "promo-posters", "hyperwrapz-nb2-wrap-reveal-poster.png"),
    name: "Colour Wrap Reveal",
    message: [
      "Nak tukar warna kereta?",
      "Hyperwrapz sediakan Colour Change Wrap - 3000+ warna, matte / satin / gloss / chrome.",
      "WhatsApp Hyperwrapz & Detailing sekarang untuk quotation.",
    ].join("\n\n"),
  },
  {
    key: "merdeka",
    file: path.join(HW, "promo-posters", "hyperwrapz-nb2-merdeka-promo.png"),
    name: "Merdeka Promo Packages",
    message: [
      "Merdeka Promo - Jaga kereta, jaga maruah.",
      "Full Front PPF + Coating dari RM1,300\nFull Car PPF + Coating RM3,300\nCombo 3-in-1 (PPF + Coating + Tint) RM4,400",
      "WhatsApp Hyperwrapz & Detailing sekarang untuk tempah slot.",
    ].join("\n\n"),
  },
  {
    key: "ppf",
    file: path.join(HW, "editorial-posters-nb2", "02-ppf-editorial.png"),
    name: "PPF Editorial",
    message: [
      "Kereta baru, sebulan dah calar?",
      "Cat jaga, hati tenang - PPF 8.5mil, self-healing, invisible.",
      "WhatsApp Hyperwrapz & Detailing sekarang.",
    ].join("\n\n"),
  },
];

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

async function uploadImage(file) {
  const form = new FormData();
  form.append("filename", new Blob([await fs.readFile(file)], { type: "image/png" }), path.basename(file));
  const result = await graph(`${ACCOUNT}/adimages`, "POST", form);
  const image = Object.values(result.images || {})[0];
  if (!image?.hash) throw new Error(`Meta did not return an image hash for ${file}`);
  return image.hash;
}

async function main() {
  await loadEnv();
  if (!process.env.META_APP_TOKEN) throw new Error("META_APP_TOKEN missing");
  for (const c of CREATIVES) await fs.access(c.file);

  const campaign = await graph(`${ACCOUNT}/campaigns`, "POST", {
    name: "Hyperwrapz | NB2 Creative Set | Facebook | WhatsApp Leads | 2026-08-01",
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

  const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
  const ads = [];
  for (const c of CREATIVES) {
    const hash = await uploadImage(c.file);
    const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
      name: `${c.name} | Facebook | WhatsApp CTA`,
      object_story_spec: { page_id: PAGE, link_data: {
        image_hash: hash,
        link: WA_LINK,
        message: c.message,
        name: c.name,
        call_to_action: cta,
      } },
    });
    const ad = await graph(`${ACCOUNT}/ads`, "POST", {
      name: `${c.name} | WhatsApp CTA`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    ads.push({ key: c.key, adId: ad.id, creativeId: creative.id });
  }

  console.log(JSON.stringify({
    campaign: campaign.id,
    adset: adset.id,
    ads,
    status: "PAUSED",
    dailyBudgetMYR: 60,
    platforms: ["facebook"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
