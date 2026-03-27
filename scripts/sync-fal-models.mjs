/**
 * Sync fal.ai model definitions with their actual OpenAPI schemas.
 * Usage: node scripts/sync-fal-models.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error("FAL_KEY not found in .env.local"); process.exit(1); }

// Parse models from models.ts
const modelsFile = readFileSync(join(__dirname, "..", "src", "lib", "models.ts"), "utf-8");
const modelBlocks = [...modelsFile.matchAll(/\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?provider:\s*"(fal|replicate)"[\s\S]*?inputs:\s*\[([\s\S]*?)\][\s\S]*?\}/g)];

const localModels = modelBlocks.map((m) => {
  const id = m[1];
  const provider = m[2];
  const inputs = [...m[3].matchAll(/\{\s*name:\s*"([^"]+)",\s*type:\s*"([^"]+)",\s*required:\s*(true|false)/g)]
    .map((inp) => ({ name: inp[1], type: inp[2], required: inp[3] === "true" }));
  return { id, provider, inputs };
}).filter((m) => m.provider === "fal");

console.log(`Found ${localModels.length} fal models to sync.\n`);

// Split model ID into base app + endpoint path
// e.g. "fal-ai/kling-video/v3/pro/text-to-video" → base="fal-ai/kling-video", endpoint="/v3/pro/text-to-video"
function splitModelId(modelId) {
  const parts = modelId.split("/");
  const base = parts.slice(0, 2).join("/");
  const endpoint = parts.length > 2 ? "/" + parts.slice(2).join("/") : "/";
  return { base, endpoint };
}

// Classify param as media input type
function classifyParam(name, prop) {
  const n = name.toLowerCase();
  if (n === "prompt" || n === "text" || n === "text_input") return "text";
  if (n.includes("image") || n.includes("frame")) return "image";
  if (n.includes("video")) return "video";
  if (n.includes("audio")) return "audio";
  const desc = (prop.description || "").toLowerCase();
  if (desc.includes("image url") || desc.includes("input image")) return "image";
  if (desc.includes("video url") || desc.includes("input video")) return "video";
  if (desc.includes("audio url") || desc.includes("input audio") || desc.includes("audio sample") || desc.includes("voice prompt")) return "audio";
  return null;
}

// Parameters that are settings/options, not primary inputs
const OPTION_PARAMS = new Set([
  "num_images", "seed", "output_format", "safety_tolerance", "sync_mode",
  "resolution", "limit_generations", "enable_web_search", "thinking_level",
  "aspect_ratio", "duration", "generate_audio", "negative_prompt", "cfg_scale",
  "num_frames", "acceleration", "guidance_scale", "num_inference_steps",
  "image_size", "steps", "scheduler", "strength", "creativity", "detail",
  "resemblance", "scale_factor", "hdr", "face_enhance", "output_type",
  "workflow_type", "gender_0", "exaggeration", "cfg", "high_quality_audio",
  "temperature", "voice", "voice_setting", "audio_setting", "language_boost",
  "pronunciation_dict", "shot_type", "multi_prompt", "sample_rate", "bitrate",
  "format", "channel", "output_format",
]);

// Cache OpenAPI specs by base app
const specCache = {};

async function fetchSpec(baseApp) {
  if (specCache[baseApp]) return specCache[baseApp];
  const res = await fetch(`https://fal.run/${baseApp}/openapi.json`, {
    headers: { Authorization: `Key ${FAL_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const spec = await res.json();
  specCache[baseApp] = spec;
  return spec;
}

function extractInputsForEndpoint(spec, endpoint) {
  const paths = spec.paths || {};
  const postOp = paths[endpoint]?.post;
  if (!postOp) return { inputs: [], options: {}, found: false };

  const schemaRef = postOp.requestBody?.content?.["application/json"]?.schema?.$ref;
  if (!schemaRef) return { inputs: [], options: {}, found: false };

  const schemaName = schemaRef.split("/").pop();
  const schema = spec.components?.schemas?.[schemaName];
  if (!schema) return { inputs: [], options: {}, found: false };

  const properties = schema.properties || {};
  const required = schema.required || [];
  const inputs = [];
  const options = {};

  for (const [name, prop] of Object.entries(properties)) {
    const isRequired = required.includes(name);
    const inputType = classifyParam(name, prop);

    if (inputType && !OPTION_PARAMS.has(name)) {
      inputs.push({
        name,
        type: inputType,
        required: isRequired,
        description: (prop.description || "").substring(0, 100),
      });
    } else if (prop.enum && ["aspect_ratio", "duration", "resolution"].includes(name)) {
      options[name] = {
        values: prop.enum.map(String),
        default: String(prop.default ?? prop.enum[0]),
        label: prop.title || name,
      };
    } else if (prop.type === "boolean" && name === "generate_audio") {
      options[name] = { default: prop.default ?? false, label: prop.title || name };
    }
  }

  return { inputs, options, found: true };
}

// Process all models
const results = [];

for (const model of localModels) {
  try {
    const { base, endpoint } = splitModelId(model.id);
    const spec = await fetchSpec(base);
    const { inputs: apiInputs, options: apiOptions, found } = extractInputsForEndpoint(spec, endpoint);

    if (!found) {
      // Try alternate endpoints
      const paths = Object.keys(spec.paths || {});
      console.log(`⚠️  ${model.id} — endpoint "${endpoint}" not found. Available: ${paths.join(", ")}`);
      results.push({ id: model.id, error: `Endpoint not found`, mismatches: [] });
      continue;
    }

    const mismatches = [];

    // Check our inputs against API
    for (const ourInput of model.inputs) {
      const apiInput = apiInputs.find((i) => i.name === ourInput.name);
      if (!apiInput) {
        mismatches.push(`  REMOVE "${ourInput.name}" (${ourInput.type}) — NOT in API`);
      } else {
        if (apiInput.required !== ourInput.required) {
          mismatches.push(`  FIX "${ourInput.name}" required: ${ourInput.required} → ${apiInput.required}`);
        }
        if (apiInput.type !== ourInput.type) {
          mismatches.push(`  FIX "${ourInput.name}" type: ${ourInput.type} → ${apiInput.type}`);
        }
      }
    }

    // Check API inputs not in ours
    for (const apiInput of apiInputs) {
      if (!model.inputs.find((i) => i.name === apiInput.name)) {
        mismatches.push(`  ADD "${apiInput.name}" (${apiInput.type}, ${apiInput.required ? "req" : "opt"}) — "${apiInput.description}"`);
      }
    }

    results.push({ id: model.id, mismatches, apiInputs, apiOptions });

    const icon = mismatches.length > 0 ? "❌" : "✅";
    console.log(`${icon} ${model.id}`);
    for (const m of mismatches) console.log(m);

    await new Promise((r) => setTimeout(r, 100));
  } catch (err) {
    console.log(`⚠️  ${model.id} — ERROR: ${err.message}`);
    results.push({ id: model.id, error: err.message, mismatches: [] });
  }
}

// Summary
console.log("\n" + "=".repeat(60));
const ok = results.filter((r) => r.mismatches?.length === 0 && !r.error);
const withIssues = results.filter((r) => r.mismatches?.length > 0);
const withErrors = results.filter((r) => r.error);
console.log(`\nTotal: ${results.length} | OK: ${ok.length} | Mismatches: ${withIssues.length} | Errors: ${withErrors.length}`);

// Output corrected inputs
if (withIssues.length > 0) {
  console.log("\n" + "=".repeat(60));
  console.log("CORRECTED INPUTS:");
  console.log("=".repeat(60));

  for (const r of withIssues) {
    console.log(`\n// ${r.id}`);
    console.log(`inputs: [`);
    for (const inp of r.apiInputs) {
      const desc = inp.description.replace(/"/g, '\\"');
      console.log(`  { name: "${inp.name}", type: "${inp.type}", required: ${inp.required}, description: "${desc}" },`);
    }
    console.log(`],`);

    if (r.apiOptions && Object.keys(r.apiOptions).length > 0) {
      console.log(`options: {`);
      for (const [key, opt] of Object.entries(r.apiOptions)) {
        if (opt.values) {
          console.log(`  ${key}: { values: ${JSON.stringify(opt.values)}, default: "${opt.default}", label: "${opt.label}" },`);
        } else {
          console.log(`  ${key}: { default: ${opt.default}, label: "${opt.label}" },`);
        }
      }
      console.log(`},`);
    }
  }
}
