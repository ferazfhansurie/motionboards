// Comfy Cloud API client.
//
// The Cloud API mirrors local ComfyUI: you submit a workflow graph to
// `/api/prompt`, poll `/api/job/:id/status`, then pull outputs out of
// `/api/history_v2/:id` and download them via `/api/view`.
//
// For user-provided inputs (character image, pose video) we upload first
// via `/api/upload/image` (which accepts arbitrary media, not just images),
// then patch the returned filename into the workflow's LoadImage/LoadVideo
// nodes before submitting.

const BASE_URL = "https://cloud.comfy.org";

function apiKey(): string {
  const key = process.env.COMFY_CLOUD_API_KEY;
  if (!key) throw new Error("COMFY_CLOUD_API_KEY is not configured");
  return key;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "X-API-Key": apiKey(), ...extra };
}

export interface ComfyUploadResult {
  name: string;
  subfolder: string;
  type: string;
}

// Fetch a remote URL (e.g. our own /api/files/:id) and upload the bytes to
// Comfy Cloud as an input file. Comfy deduplicates by content so uploading
// the same asset twice returns the same name.
export async function uploadFromUrl(sourceUrl: string, fallbackName: string): Promise<ComfyUploadResult> {
  const srcRes = await fetch(sourceUrl);
  if (!srcRes.ok) throw new Error(`Failed to fetch input from ${sourceUrl}: ${srcRes.status}`);
  const mime = srcRes.headers.get("content-type") || "application/octet-stream";
  const blob = await srcRes.blob();

  const form = new FormData();
  form.append("image", new File([blob], fallbackName, { type: mime }));
  form.append("type", "input");
  form.append("overwrite", "true");

  const upRes = await fetch(`${BASE_URL}/api/upload/image`, {
    method: "POST",
    headers: authHeaders(), // don't set Content-Type — let fetch set the multipart boundary
    body: form,
  });
  if (!upRes.ok) {
    const err = await upRes.text().catch(() => "");
    throw new Error(`Comfy upload failed (${upRes.status}): ${err.slice(0, 300)}`);
  }
  const data = (await upRes.json()) as Partial<ComfyUploadResult>;
  if (!data.name) throw new Error("Comfy upload returned no filename");
  return { name: data.name, subfolder: data.subfolder || "", type: data.type || "input" };
}

export async function submitPrompt(workflow: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/prompt`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Comfy submit failed (${res.status}): ${err.slice(0, 500)}`);
  }
  const data = (await res.json()) as { prompt_id?: string };
  if (!data.prompt_id) throw new Error("Comfy submit returned no prompt_id");
  return data.prompt_id;
}

export type ComfyJobStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export async function getJobStatus(promptId: string): Promise<ComfyJobStatus> {
  const res = await fetch(`${BASE_URL}/api/job/${promptId}/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Comfy status check failed: ${res.status}`);
  const data = (await res.json()) as { status?: ComfyJobStatus };
  return (data.status as ComfyJobStatus) || "pending";
}

export interface ComfyOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

export interface ComfyHistoryOutputs {
  [nodeId: string]: {
    images?: ComfyOutputFile[];
    video?: ComfyOutputFile[];
    audio?: ComfyOutputFile[];
    gifs?: ComfyOutputFile[];
  };
}

export async function getHistoryOutputs(promptId: string): Promise<ComfyHistoryOutputs> {
  const res = await fetch(`${BASE_URL}/api/history_v2/${promptId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Comfy history fetch failed: ${res.status}`);
  const data = (await res.json()) as { outputs?: ComfyHistoryOutputs };
  return data.outputs || {};
}

// `/api/view` returns a 302 to a short-lived signed storage URL. Follow the
// redirect manually so we can fetch the signed URL WITHOUT the auth header
// (the storage bucket rejects the header and it's redundant anyway).
export async function downloadOutput(file: ComfyOutputFile): Promise<{ buffer: Buffer; mimeType: string }> {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  const viewRes = await fetch(`${BASE_URL}/api/view?${params.toString()}`, {
    headers: authHeaders(),
    redirect: "manual",
  });
  let signedUrl: string | null = null;
  if (viewRes.status === 302 || viewRes.status === 303 || viewRes.status === 307 || viewRes.status === 308) {
    signedUrl = viewRes.headers.get("location");
  } else if (viewRes.ok) {
    // Some Node fetch implementations swallow the 302 and return the body
    // directly. Fall back to using the initial response.
    const buf = Buffer.from(await viewRes.arrayBuffer());
    return { buffer: buf, mimeType: viewRes.headers.get("content-type") || "application/octet-stream" };
  }
  if (!signedUrl) throw new Error(`Comfy view redirect missing (status ${viewRes.status})`);

  const fileRes = await fetch(signedUrl);
  if (!fileRes.ok) throw new Error(`Comfy signed download failed: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const mimeType = fileRes.headers.get("content-type") || inferMimeFromFilename(file.filename);
  return { buffer, mimeType };
}

function inferMimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

// Find the first video/image output across all nodes. Prefers video (this
// provider is wired up for v2v Wan Animate) but falls back to image/gif for
// other workflows we might host later.
export function pickOutputFile(outputs: ComfyHistoryOutputs): ComfyOutputFile | null {
  for (const nodeOutputs of Object.values(outputs)) {
    if (nodeOutputs.video && nodeOutputs.video[0]) return nodeOutputs.video[0];
  }
  for (const nodeOutputs of Object.values(outputs)) {
    if (nodeOutputs.gifs && nodeOutputs.gifs[0]) return nodeOutputs.gifs[0];
  }
  for (const nodeOutputs of Object.values(outputs)) {
    if (nodeOutputs.images && nodeOutputs.images[0]) return nodeOutputs.images[0];
  }
  for (const nodeOutputs of Object.values(outputs)) {
    if (nodeOutputs.audio && nodeOutputs.audio[0]) return nodeOutputs.audio[0];
  }
  return null;
}
