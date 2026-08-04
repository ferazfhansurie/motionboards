import { promises as fs } from "node:fs";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const IG = "17841448306375961";
const CAMPAIGN = "52546489843948";
const ADSET = "52546489849548";
const PAGE_VIDEO_ID = "1557766529229504";
const GRAPH = "https://graph.facebook.com/v23.0";
const THUMBNAIL = `${ROOT}/SG fathopes new Photos/file_1784541971790_4d8fcfca8994.jpeg`;
async function env() { const raw = await fs.readFile(`${ROOT}/env.local`, "utf8"); for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } }
async function graph(endpoint, body) { const res = await fetch(`${GRAPH}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, access_token: process.env.META_APP_TOKEN }) }); const json = await res.json().catch(() => ({})); if (!res.ok || json.error) throw new Error(JSON.stringify(json.error || json)); return json; }
async function uploadThumbnail() { const form = new FormData(); form.append("access_token", process.env.META_APP_TOKEN); form.append("filename", new Blob([await fs.readFile(THUMBNAIL)], { type: "image/jpeg" }), "hyperwrapz-video-thumbnail.jpg"); const res = await fetch(`${GRAPH}/${ACCOUNT}/adimages`, { method: "POST", body: form }); const json = await res.json().catch(() => ({})); if (!res.ok || json.error) throw new Error(JSON.stringify(json.error || json)); const first = Object.values(json.images || {})[0]; if (!first?.hash) throw new Error(`No thumbnail hash: ${JSON.stringify(json)}`); return first.hash; }
async function main() { await env(); const thumbnailHash = await uploadThumbnail(); const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }; const caption = "Kereta lama tapi nak new look? Hyperwrapz & Detailing bantu upgrade look dan protect kereta korang. WhatsApp 011-6188 4476 untuk consultation."; const creative = await graph(`${ACCOUNT}/adcreatives`, { name: "Video | Colour Wrap | Hyperwrapz | WhatsApp", object_story_spec: { page_id: PAGE, instagram_user_id: IG, video_data: { video_id: PAGE_VIDEO_ID, image_hash: thumbnailHash, title: "Colour Change Wrap", message: caption, call_to_action: cta } } }); const ad = await graph(`${ACCOUNT}/ads`, { name: "Video | Colour Wrap", adset_id: ADSET, creative: { creative_id: creative.id }, status: "PAUSED" }); console.log(JSON.stringify({ campaign: CAMPAIGN, adset: ADSET, video_ad: ad.id, creative: creative.id, status: "PAUSED" }, null, 2)); }
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
