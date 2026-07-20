// ADletic digital marketing solutions poster pack via MotionBoards Nano Banana 2.
// Reference-fed: ADletic logo + older deck thumbnail + previous RM1 editorial posters.
//   node scripts/gen-digital-marketing-nb2-v2.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "aios", "outputs", "2026-07-08-adletic-digital-marketing-nb2-v2");

const REFS = [
  {
    label: "ADletic circular logo",
    path: path.join(ROOT, "public", "Freelance", "Adetic.png"),
  },
  {
    label: "ADletic older PDF hero page thumbnail",
    path: "/tmp/adletic-pdf-preview/ADletics Agency.pdf.png",
  },
  {
    label: "Previous ADletic receipt editorial poster",
    path: path.join(ROOT, "aios", "outputs", "2026-07-04-adletic-rm1-posters", "editorial_resit.png"),
  },
  {
    label: "Previous ADletic RM100 editorial poster",
    path: path.join(ROOT, "aios", "outputs", "2026-07-04-adletic-rm1-posters", "editorial_rm100.png"),
  },
];

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

async function ensurePdfThumb() {
  const thumb = REFS[1].path;
  try {
    await fs.access(thumb);
    return;
  } catch {}
  await fs.mkdir(path.dirname(thumb), { recursive: true });
  throw new Error(`Missing PDF thumbnail ${thumb}. Run: qlmanage -t -s 1200 -o /tmp/adletic-pdf-preview '/Users/faeez/Library/Mobile Documents/com~apple~CloudDocs/ADletics Agency.pdf'`);
}

async function dataUri(file) {
  const buf = await sharp(file)
    .resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const STYLE = `Use the attached references:
1 = ADletic circular logo, preserve it accurately as a small brand seal near the bottom.
2 = older ADletic agency deck: navy/orange performance marketing identity and low-cost lead positioning.
3 and 4 = previous ADletic RM1 lead editorial posters: use their evidence-first, real-object, receipt/corkboard style as the MAIN visual language.

Create a premium 9:16 vertical Facebook/Instagram ad poster for ADletic Agency in Malaysia.
Audience: Malaysian SME/SMB owners who run ads, boost posts, or need digital marketing help.
Make the poster look like a real photographed marketing artifact, not a generic agency ad.
Dark charcoal, warm orange, off-white paper, navy details. Editorial lighting, realistic shadows.
No stock handshake, no fake smiling laptop people, no generic "digital marketing" icons.
No big logo splash. No QR code. No fake URL. No extra phone number. No watermark.

Use exact text only. Keep text large, clean, and mobile-readable.`;

const posters = [
  {
    slug: "01-ad-spend-leak",
    prompt: `${STYLE}

Concept: A realistic "ad spend autopsy" desk scene. A printed ads report, a calculator, orange marker circles around wasted spend, small sticky note, and a phone with abstract lead notification cards. It should feel like ADletic is diagnosing where money leaks.

Exact text:
Headline: "Bajet iklan keluar. Customer tak masuk?"
Label: "FREE ADS LEAK AUDIT"
CTA: "Isi form. Kami check."

Composition: headline top, photographed evidence object in the middle, CTA bottom. Serious, premium, local, not hype.`,
  },
  {
    slug: "02-boost-post",
    prompt: `${STYLE}

Concept: A sad boosted-post result printed like an evidence sheet on a desk. Generic social ad UI only, no Facebook logo. The sheet shows abstract blocks for reach, likes, comments, and a red/orange stamp that says "BOOSTED". A black marker note points to weak results.

Exact text:
Headline: "Boost post bukan strategy."
Label: "DIGITAL MARKETING SOLUTIONS"
CTA: "Jom betulkan funnel."

Make it funny-but-serious, like the viewer has done this before and now wants a proper system.`,
  },
  {
    slug: "03-full-funnel",
    prompt: `${STYLE}

Concept: A polished marketing funnel map on a corkboard, like a detective board but clean and premium. Four off-white cards connected with orange thread: CONTENT, ADS, FORM, FOLLOW-UP. Add small lead cards and a clean analytics card. Use the previous corkboard/RM100 poster as styling reference, but do not copy the currency note.

Exact text:
Headline: "Iklan bagus tak cukup."
Label: "FULL FUNNEL MARKETING"
CTA: "Audit funnel free."

The visual message: ADletic handles the whole system, not only media buying.`,
  },
  {
    slug: "04-leads-to-sales",
    prompt: `${STYLE}

Concept: Phone lockscreen with lead notifications on a premium dark desk, next to a handwritten follow-up checklist and orange tick marks. This should feel like the missing bridge between leads and actual sales.

Exact text:
Headline: "Lead masuk. Sales jalan."
Label: "ADS + WHATSAPP + FOLLOW-UP"
CTA: "Build the system."

Keep it clean, sharp, believable. Avoid crowded UI. The phone text can be abstract except for the main poster text.`,
  },
  {
    slug: "05-rm100-test",
    prompt: `${STYLE}

Concept: A stylised orange RM100 test voucher pinned to a dark corkboard with an orange pushpin. Around it are small abstract lead cards, ad cards, and a simple 7-day test timeline. Do NOT show real Malaysian currency or banknote details. It is a voucher/chip, not money.

Exact text:
Headline: "Bagi RM100. Kita test."
Label: "SMB AD TEST"
CTA: "Kira sendiri lepas 7 hari."

Serious dare energy. Trust-building, not overpromising.`,
  },
];

async function generate(base, key, prompt, inputImages) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image-preview",
        prompt,
        inputImages,
        generationOptions: { aspect_ratio: "9:16", resolution: "2K" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;
    if ((res.status === 429 || /rate.?limit/i.test(JSON.stringify(json))) && attempt <= 10) {
      process.stdout.write(`(429 #${attempt}, 45s) `);
      await sleep(45000);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
}

async function main() {
  await loadEnv();
  await ensurePdfThumb();
  const base = process.env.MB_BASE || "https://motionboards.vercel.app";
  const key = process.env.MB_API_KEY || process.env.MB_KEY;
  if (!key) throw new Error("No API key. Expected MB_API_KEY or MB_KEY in env.local.");
  await fs.mkdir(OUT, { recursive: true });

  const inputImages = [];
  for (const ref of REFS) {
    inputImages.push(await dataUri(ref.path));
  }

  const manifest = { refs: REFS, outputs: [] };
  for (const p of posters) {
    process.stdout.write(`[${p.slug}] ... `);
    const r = await generate(base, key, p.prompt, inputImages);
    if (r.status !== "completed" || !r.outputUrl) {
      console.log(`unexpected: ${JSON.stringify(r).slice(0, 180)}`);
      manifest.outputs.push({ slug: p.slug, status: "unexpected", response: r });
      continue;
    }
    const img = await fetch(r.outputUrl, { headers: { Authorization: `Bearer ${key}` } });
    const buf = Buffer.from(await img.arrayBuffer());
    const out = path.join(OUT, `${p.slug}.png`);
    await fs.writeFile(out, buf);
    await fs.writeFile(path.join(OUT, `${p.slug}.prompt.txt`), p.prompt, "utf8");
    manifest.outputs.push({ slug: p.slug, file: out, outputUrl: r.outputUrl });
    console.log(`saved ${(buf.length / 1024).toFixed(0)} KB`);
  }

  await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fs.writeFile(path.join(OUT, "README.md"), `# ADletic digital marketing solutions - Nano Banana 2 v2

Generated through MotionBoards Nano Banana 2 using local ADletic references:
- circular logo
- ADletics Agency PDF thumbnail
- previous RM1 receipt/RM100 editorial posters

Angle: Free Ads Leak Audit / full-funnel digital marketing solutions for Malaysian SMB owners.
`, "utf8");
  console.log(`Done. Output in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
