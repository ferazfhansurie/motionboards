// Duplicate the ADletic "dashboard v3" lead-form ad set into a WhatsApp-CTA
// version: same targeting/creative assets, CTA swapped SIGN_UP(lead form) ->
// WHATSAPP_MESSAGE. Everything created PAUSED first.
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACT = "act_417768795415719";
const CAMP = "120251300678740414";
const PAGE = "895770496960508";
const WA = "601121677522";
const V = "v21.0";

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const TOK = () => process.env.META_APP_TOKEN;

async function api(pathStr, method, body) {
  const url = `https://graph.facebook.com/${V}/${pathStr}`;
  const opts = { method, headers: {} };
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${method} ${pathStr}: ${JSON.stringify(j.error || j).slice(0, 500)}`);
  return j;
}

const WA_LINK = `https://wa.me/${WA}?text=Hi%20ADletic%2C%20nak%20claim%20Free%20KPI%20Leak%20Check`;

// swap the form-CTA closing line for a WhatsApp one
const swapLine = (msg) => msg.replace(/Isi form bawah ni\s*👇/gi, "WhatsApp kami je 👇");

const ADS = [
  {
    slug: "wa-owner-realtime",
    name: "Nak tau performance, tak payah tanya sesiapa",
    image_hash: "cb952a6095bfc6725a95d631b90a93f2",
    message: swapLine(`Satu skrin, semua performance bisnes you, live — tak payah call staff atau tunggu report.\n\nUntuk owner yang nak tau jawapan terus.\n\nStart dengan Free KPI Leak Check, kami tengok number you dulu.\n\nIsi form bawah ni 👇`),
  },
  {
    slug: "wa-time-leak",
    name: "3 jam sehari copy-paste Excel",
    image_hash: "23f1f43beb437067efa8baf87282e154",
    message: swapLine(`3 jam sehari copy-paste Excel. Sepatutnya 3 saat.\n\nData dah ada dalam sistem you — kami sambungkan terus jadi dashboard live.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇`),
  },
  {
    slug: "wa-growing-pains-competitor",
    name: "Competitor you dah guna dashboard",
    image_hash: "0ec851b86a773f9e48e4452190ccb972",
    message: swapLine(`Competitor you dah guna dashboard. You still guna Excel?\n\nCustom dashboard development untuk owner yang nak kekal depan.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇`),
  },
  {
    slug: "wa-decision-trust",
    name: "Number pun tak sure betul ke tak",
    image_hash: "25155cc8760e4ff35711b6b17ba18363",
    message: swapLine(`Buat keputusan besar, tapi number pun tak sure betul ke tak.\n\nSatu sumber data yang boleh dipercayai — tiada lagi rasa-rasa.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇`),
  },
];

const VIDEO_AD = {
  slug: "wa-video-demo",
  name: "Satu dashboard. Semua nombor penting.",
  video_id: "1362562192667305",
  image_url: "https://www.facebook.com/ads/image/?d=AQI8ro9hiEW0mtUxHKVHFqFUr-5qe8qoDdLGiPv8ge3jEKQZWmsHmQbM2DrL4pmU6Bk2EQ5wBXlV7GfxvsTkm4qJW_SQ_R8JyP1u1NMP4IEICL8G5dlhb3Z0fcIFHKw1eD-DBALRvo-mXNiohNjhSEN-",
  message: swapLine(`Tengok macam mana satu dashboard boleh gantikan 12 spreadsheet dan report yang tak pernah dibuka.\n\nCustom-built untuk bisnes you, bukan template generik.\n\nStart dengan Free KPI Leak Check, kami tengok number you dulu.\n\nIsi form bawah ni 👇`),
};

async function createCampaign() {
  const body = {
    name: "ADletic | Custom Software Solutions (WhatsApp CTA)",
    objective: "OUTCOME_LEADS",
    special_ad_categories: [],
    daily_budget: 6000, // RM60, matches the parent campaign's CBO level
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
    access_token: TOK(),
  };
  const r = await api(`${ACT}/campaigns`, "POST", body);
  return r.id;
}

async function createAdSet(campId) {
  const body = {
    name: "ADletic | MY business hubs | dashboard v3 (WhatsApp CTA)",
    campaign_id: campId,
    optimization_goal: "CONVERSATIONS",
    destination_type: "WHATSAPP",
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    promoted_object: { page_id: PAGE },
    targeting: {
      age_min: 25,
      age_max: 65,
      flexible_spec: [{ behaviors: [{ id: "6002714898572", name: "Small business owners" }] }],
      geo_locations: { countries: ["MY"], location_types: ["home", "recent"] },
      targeting_automation: { advantage_audience: 1 },
    },
    status: "PAUSED",
    access_token: TOK(),
  };
  const r = await api(`${ACT}/adsets`, "POST", body);
  return r.id;
}

async function createImageCreative(ad) {
  const body = {
    name: `${ad.name} | WA creative`,
    object_story_spec: {
      page_id: PAGE,
      link_data: {
        message: ad.message,
        image_hash: ad.image_hash,
        name: ad.name,
        link: WA_LINK,
        call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP", link: WA_LINK } },
      },
    },
    access_token: TOK(),
  };
  const r = await api(`${ACT}/adcreatives`, "POST", body);
  return r.id;
}

async function createVideoCreative(ad) {
  const body = {
    name: `${ad.name} | WA creative`,
    object_story_spec: {
      page_id: PAGE,
      video_data: {
        video_id: ad.video_id,
        image_url: ad.image_url,
        title: ad.name,
        message: ad.message,
        call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } },
      },
    },
    access_token: TOK(),
  };
  const r = await api(`${ACT}/adcreatives`, "POST", body);
  return r.id;
}

async function createAd(name, adsetId, creativeId) {
  const body = { name, adset_id: adsetId, creative: { creative_id: creativeId }, status: "PAUSED", access_token: TOK() };
  const r = await api(`${ACT}/ads`, "POST", body);
  return r.id;
}

async function main() {
  await loadEnv();
  if (!TOK()) throw new Error("no META_APP_TOKEN");

  console.log("creating campaign (paused)...");
  const campId = await createCampaign();
  console.log("campaign:", campId);

  console.log("creating ad set (paused)...");
  const adsetId = await createAdSet(campId);
  console.log("adset:", adsetId);

  const out = [];
  for (const ad of ADS) {
    process.stdout.write(`[${ad.slug}] creative... `);
    const cid = await createImageCreative(ad);
    process.stdout.write(`ad... `);
    const aid = await createAd(`WA | ${ad.name}`, adsetId, cid);
    console.log(`OK ad=${aid}`);
    out.push({ slug: ad.slug, creative: cid, ad: aid });
  }

  process.stdout.write(`[${VIDEO_AD.slug}] creative... `);
  const vcid = await createVideoCreative(VIDEO_AD);
  process.stdout.write(`ad... `);
  const vaid = await createAd(`WA | ${VIDEO_AD.name}`, adsetId, vcid);
  console.log(`OK ad=${vaid}`);
  out.push({ slug: VIDEO_AD.slug, creative: vcid, ad: vaid });

  await fs.writeFile(path.join(ROOT, "scripts", "_tmp_adletic_wa_ids.json"), JSON.stringify({ adsetId, ads: out }, null, 2));
  console.log("\nCreated ad set + 5 ads, all PAUSED. IDs saved.");
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
