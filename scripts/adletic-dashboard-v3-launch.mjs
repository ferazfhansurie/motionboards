// ADletic custom-dashboard offer — v3 batch: 1 video dark post (DASHBOARD AD(5).mp4)
// + 5 new poster dark posts, added as a new PAUSED ad set under the existing
// "ADletic | Custom Software Solutions" campaign (120251300678740414).
// Mirrors the exact object_story_spec / lead-form / WA-CTA pattern of the live ads.
// Creates everything PAUSED — nothing activates until explicitly told to.
//   node scripts/adletic-dashboard-v3-launch.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTER_DIR = path.join(ROOT, "aios", "outputs", "2026-07-18-adletic-dashboard-posters-v3");
const VIDEO_PATH = "/Users/faeez/Downloads/DASHBOARD AD(5).mp4";

const ACCOUNT_ID = "417768795415719"; // act id (no act_ prefix)
const CAMPAIGN_ID = "120251300678740414";
const PAGE_ID = "895770496960508";
const LEAD_FORM_ID = "1560911188712972";
const WA_NUMBER = "601121677522";

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

const GRAPH = "https://graph.facebook.com/v23.0";
let TOKEN;

async function gget(edge, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${edge}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${edge} -> ${JSON.stringify(json)}`);
  return json;
}
async function gpost(edge, body) {
  const res = await fetch(`${GRAPH}/${edge}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${edge} -> ${JSON.stringify(json)}`);
  return json;
}
async function gpostForm(edge, form) {
  form.append("access_token", TOKEN);
  const res = await fetch(`${GRAPH}/${edge}`, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST(form) ${edge} -> ${JSON.stringify(json)}`);
  return json;
}

const posters = [
  { slug: "v3-01-owner-realtime", name: "Nak tau performance, tak payah tanya sesiapa", message: "Satu skrin, semua performance bisnes you, live — tak payah call staff atau tunggu report.\n\nUntuk owner yang nak tau jawapan terus.\n\nStart dengan Free KPI Leak Check, kami tengok number you dulu.\n\nIsi form bawah ni 👇" },
  { slug: "v3-02-time-leak", name: "3 jam sehari copy-paste Excel", message: "3 jam sehari copy-paste Excel. Sepatutnya 3 saat.\n\nData dah ada dalam sistem you — kami sambungkan terus jadi dashboard live.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇" },
  { slug: "v3-03-growing-pains", name: "Bisnes dah besar, spreadsheet still yang lama", message: "Bila bisnes dah besar, spreadsheet mula pecah.\n\nDashboard custom kami scale ikut you — satu hero number, semua KPI penting dalam satu tempat.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇" },
  { slug: "v3-04-decision-trust", name: "Number pun tak sure betul ke tak", message: "Buat keputusan besar, tapi number pun tak sure betul ke tak.\n\nSatu sumber data yang boleh dipercayai — tiada lagi rasa-rasa.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇" },
  { slug: "v3-05-competitive", name: "Competitor you dah guna dashboard", message: "Competitor you dah guna dashboard. You still guna Excel?\n\nCustom dashboard development untuk owner yang nak kekal depan.\n\nStart dengan Free KPI Leak Check.\n\nIsi form bawah ni 👇" },
];

const videoAd = {
  name: "DASHBOARD | Video — command center demo",
  message: "Tengok macam mana satu dashboard boleh gantikan 12 spreadsheet dan report yang tak pernah dibuka.\n\nCustom-built untuk bisnes you, bukan template generik.\n\nStart dengan Free KPI Leak Check, kami tengok number you dulu.\n\nIsi form bawah ni 👇",
  title: "Satu dashboard. Semua nombor penting.",
};

const linkUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi ADletic, nak claim Free KPI Leak Check")}`;

async function uploadImage(slug) {
  const file = path.join(POSTER_DIR, `${slug}.png`);
  const form = new FormData();
  form.append("filename", new Blob([await fs.readFile(file)]), `${slug}.png`);
  const json = await gpostForm(`act_${ACCOUNT_ID}/adimages`, form);
  const entry = Object.values(json.images)[0];
  return entry.hash;
}

async function uploadVideo() {
  const buf = await fs.readFile(VIDEO_PATH);
  const form = new FormData();
  form.append("source", new Blob([buf]), "DASHBOARD-AD-5.mp4");
  form.append("name", "ADletic Dashboard v3 — command center demo");
  const json = await gpostForm(`act_${ACCOUNT_ID}/advideos`, form);
  return json.id;
}

async function waitForVideoReady(videoId, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  for (;;) {
    const v = await gget(videoId, { fields: "status,picture" });
    const state = v.status?.video_status;
    process.stdout.write(`  video status: ${state} `);
    if (state === "ready") return v;
    if (state === "error") throw new Error(`video processing failed: ${JSON.stringify(v)}`);
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for video processing");
    await new Promise((r) => setTimeout(r, 10000));
  }
}

async function getVideoThumbnail(videoId) {
  const t = await gget(`${videoId}/thumbnails`, { fields: "uri,is_preferred" });
  const preferred = t.data.find((x) => x.is_preferred) || t.data[0];
  return preferred?.uri;
}

async function main() {
  await loadEnv();
  TOKEN = process.env.META_APP_TOKEN;
  if (!TOKEN) throw new Error("META_APP_TOKEN missing in env.local");

  console.log("1) Fetching live ad set targeting to clone...");
  const liveAdset = await gget("120251300771480414", { fields: "targeting,optimization_goal,billing_event,destination_type,promoted_object" });

  console.log("2) Creating new PAUSED ad set under campaign", CAMPAIGN_ID);
  const adset = await gpost(`act_${ACCOUNT_ID}/adsets`, {
    name: "ADletic | MY business hubs | dashboard v3 (video + posters)",
    campaign_id: CAMPAIGN_ID,
    status: "PAUSED",
    optimization_goal: liveAdset.optimization_goal,
    billing_event: liveAdset.billing_event,
    destination_type: liveAdset.destination_type,
    promoted_object: liveAdset.promoted_object,
    targeting: liveAdset.targeting,
  });
  console.log("   adset:", adset.id);

  console.log("3) Uploading 5 poster images...");
  const imageHashes = {};
  for (const p of posters) {
    imageHashes[p.slug] = await uploadImage(p.slug);
    console.log(`   ${p.slug} -> ${imageHashes[p.slug]}`);
  }

  console.log("4) Uploading video (this can take a minute for ~96MB)...");
  const videoId = await uploadVideo();
  console.log("   video_id:", videoId);
  console.log("5) Waiting for Meta to finish processing the video...");
  await waitForVideoReady(videoId);
  const thumbUri = await getVideoThumbnail(videoId);
  console.log("\n   thumbnail:", thumbUri);

  console.log("6) Creating ad creatives + PAUSED ads...");
  const created = [];

  for (const p of posters) {
    const creative = await gpost(`act_${ACCOUNT_ID}/adcreatives`, {
      name: `${p.name} 2026-07-18-v3`,
      object_story_spec: {
        page_id: PAGE_ID,
        link_data: {
          link: linkUrl,
          message: p.message,
          name: p.name,
          image_hash: imageHashes[p.slug],
          call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: LEAD_FORM_ID } },
        },
      },
    });
    const ad = await gpost(`act_${ACCOUNT_ID}/ads`, {
      name: `DASHBOARD v3 | ${p.name}`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    created.push({ slug: p.slug, creative: creative.id, ad: ad.id });
    console.log(`   [${p.slug}] creative=${creative.id} ad=${ad.id}`);
  }

  const videoCreative = await gpost(`act_${ACCOUNT_ID}/adcreatives`, {
    name: `${videoAd.name} 2026-07-18-v3`,
    object_story_spec: {
      page_id: PAGE_ID,
      video_data: {
        video_id: videoId,
        image_url: thumbUri,
        title: videoAd.title,
        message: videoAd.message,
        call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: LEAD_FORM_ID } },
      },
    },
  });
  const videoAdObj = await gpost(`act_${ACCOUNT_ID}/ads`, {
    name: `DASHBOARD v3 | ${videoAd.name}`,
    adset_id: adset.id,
    creative: { creative_id: videoCreative.id },
    status: "PAUSED",
  });
  created.push({ slug: "video", creative: videoCreative.id, ad: videoAdObj.id });
  console.log(`   [video] creative=${videoCreative.id} ad=${videoAdObj.id}`);

  console.log("\nDONE. Everything created PAUSED.");
  console.log(JSON.stringify({ adset: adset.id, created }, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
