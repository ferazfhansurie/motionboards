import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACCOUNT = "act_3681677928638351";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const WA_LINK = "https://wa.me/601161884476";
const SRC = path.join(ROOT, "Hyperwrapz & Detailing", "use this");

const ADS = [
  {
    adId: "52549769637548", // was "PPF Editorial"
    file: path.join(SRC, "file_1785573165568_5f9ba25a2bc0.jpeg"),
    name: "PPF - Define Your Style",
    message: "Paint Protection Film. Define your style.\n\nSelf-healing, hydrophobic, 8.5 mil film - drive with peace of mind.\n\nWhatsApp Hyperwrapz & Detailing sekarang.",
  },
  {
    adId: "52549769633148", // was "Merdeka Promo Packages"
    file: path.join(SRC, "file_1785574409232_282c0b033055.jpeg"),
    name: "Full Car Protection Packages",
    message: "Peh takkan taknak protect kereta, harga ada promo ni!\n\nFull Front PPF + Coating dari RM1,300\nFull Car PPF + Coating RM3,300\nCombo 3-in-1 (PPF + Coating + Tint) RM4,400\n\nWhatsApp Hyperwrapz & Detailing sekarang untuk tempah slot.",
  },
  {
    adId: "52549769627148", // was "Colour Wrap Reveal"
    file: path.join(SRC, "file_1785574508106_bb58ee636d1a.jpeg"),
    name: "Ceramic Coating - Cermin Muka",
    message: "Weeeeh... kilat kereta saya, boleh jadi cermin muka!\n\nTajamkan kilatan. Pemanduan penuh yakin - ceramic coating 9H, hasil hidrofobik, tahan UV & calar.\n\nWhatsApp Hyperwrapz & Detailing sekarang.",
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
  form.append("filename", new Blob([await fs.readFile(file)], { type: "image/jpeg" }), path.basename(file));
  const result = await graph(`${ACCOUNT}/adimages`, "POST", form);
  const image = Object.values(result.images || {})[0];
  if (!image?.hash) throw new Error(`Meta did not return an image hash for ${file}`);
  return image.hash;
}

async function main() {
  await loadEnv();
  if (!process.env.META_APP_TOKEN) throw new Error("META_APP_TOKEN missing");
  const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };

  for (const ad of ADS) {
    await fs.access(ad.file);
    const hash = await uploadImage(ad.file);
    const creative = await graph(`${ACCOUNT}/adcreatives`, "POST", {
      name: `${ad.name} | Facebook | WhatsApp CTA`,
      object_story_spec: { page_id: PAGE, link_data: {
        image_hash: hash,
        link: WA_LINK,
        message: ad.message,
        name: ad.name,
        call_to_action: cta,
      } },
    });
    const updated = await graph(`${ad.adId}`, "POST", { creative: { creative_id: creative.id } });
    console.log(ad.adId, "->", ad.name, "-> new creative", creative.id, JSON.stringify(updated));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
