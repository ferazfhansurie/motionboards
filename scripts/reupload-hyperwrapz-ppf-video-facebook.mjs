import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const PAGE = "121551227591222";
const GRAPH = "https://graph.facebook.com/v23.0";
const VIDEO = path.join(ROOT, "FatHopes IMG", "hyperwrapz-ppf-30s-facebook-ad.mp4");
const CAPTION = [
  "Kereta sayang tapi takut cat cepat calar?",
  "PPF bantu protect paint daripada stone chips, scratches dan daily wear.",
  "Package start dari RM1,300.",
  "WhatsApp Hyperwrapz & Detailing sekarang untuk check package yang sesuai untuk kereta you.",
].join("\n\n");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, "env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function graph(endpoint, method = "GET", body, accessToken = process.env.META_APP_TOKEN) {
  const url = new URL(`${GRAPH}/${endpoint}`);
  const options = { method };
  if (body instanceof FormData) {
    body.set("access_token", accessToken);
    options.body = body;
  } else if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify({ ...body, access_token: accessToken });
  } else {
    url.searchParams.set("access_token", accessToken);
  }
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function main() {
  await loadEnv();
  const pages = await graph("me/accounts?fields=id,access_token");
  const page = pages.data?.find((item) => item.id === PAGE);
  if (!page?.access_token) throw new Error("Hyperwrapz Page access is unavailable");
  const form = new FormData();
  form.append("source", new Blob([await fs.readFile(VIDEO)], { type: "video/mp4" }), path.basename(VIDEO));
  form.append("title", "PPF Protection Packages | Hyperwrapz & Detailing");
  form.append("description", CAPTION);
  const video = await graph(`${PAGE}/videos`, "POST", form, page.access_token);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const feed = await graph(`${PAGE}/feed?fields=id,message,permalink_url,created_time&limit=25`, "GET", undefined, page.access_token);
    const post = feed.data?.find((item) => item.message === CAPTION);
    if (post) {
      console.log(JSON.stringify({ videoId: video.id, postId: post.id, permalink: post.permalink_url, caption: CAPTION }, null, 2));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Video ${video.id} was uploaded but its Page post could not be resolved`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
