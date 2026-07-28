// Client-side face blur — "mosaic hack". Detects faces on-device with the
// browser's native FaceDetector (Shape Detection API), then pixelates each face
// on a <canvas>. Nothing is uploaded during detection; faces never leave the
// browser. Works for both stills and video (video is re-encoded frame-by-frame
// via canvas.captureStream + MediaRecorder). Chrome/Edge on macOS/Windows back
// FaceDetector with the OS vision framework; where it's missing we surface a
// clear "unsupported" error instead of silently doing nothing.

export type FaceBlurErrorCode = "unsupported" | "no-faces" | "load-failed" | "record-failed";

export class FaceBlurError extends Error {
  code: FaceBlurErrorCode;
  constructor(code: FaceBlurErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "FaceBlurError";
  }
}

// Minimal shape of the (un-typed) FaceDetector Web API.
interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}
interface FaceDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedFace[]>;
}
type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

function getFaceDetector(fastMode: boolean): FaceDetectorLike {
  const Ctor = (globalThis as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!Ctor) {
    throw new FaceBlurError(
      "unsupported",
      "Face blur needs the browser's face detector, which isn't available here. It works in Chrome or Edge on Mac/Windows — try there, or turn on chrome://flags → \"Experimental Web Platform features\".",
    );
  }
  return new Ctor({ fastMode, maxDetectedFaces: 20 });
}

export function faceBlurSupported(): boolean {
  return typeof globalThis !== "undefined" && "FaceDetector" in globalThis;
}

// Grow a tight detector box outward so hair/chin/ears are covered too.
function expand(b: { x: number; y: number; width: number; height: number }, w: number, h: number) {
  const padX = b.width * 0.18;
  const padY = b.height * 0.28;
  const x = Math.max(0, b.x - padX);
  const y = Math.max(0, b.y - padY);
  return {
    x,
    y,
    width: Math.min(w - x, b.width + padX * 2),
    height: Math.min(h - y, b.height + padY * 2),
  };
}

// Pixelate one region of `canvas` in place by downsampling then upscaling with
// smoothing off.
function mosaicRegion(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
) {
  const { x, y, width, height } = box;
  if (width < 2 || height < 2) return;
  const block = Math.max(3, Math.round(Math.min(width, height) / 9));
  const cols = Math.max(1, Math.round(width / block));
  const rows = Math.max(1, Math.round(height / block));
  const tmp = document.createElement("canvas");
  tmp.width = cols;
  tmp.height = rows;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(canvas, x, y, width, height, 0, 0, cols, rows);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, cols, rows, x, y, width, height);
  ctx.imageSmoothingEnabled = prev;
}

// Load a URL into an <img> without tainting the canvas (fetch to a same-origin
// blob first; /api/files URLs are same-origin so this always works).
async function loadImage(url: string): Promise<HTMLImageElement> {
  let objectUrl: string | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) objectUrl = URL.createObjectURL(await res.blob());
  } catch {
    /* fall through to direct load */
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  const src = objectUrl || url;
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new FaceBlurError("load-failed", "Couldn't load the image."));
      img.src = src;
    });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  return img;
}

// Blur every face in a still. Returns a PNG blob. Throws FaceBlurError
// ("no-faces" if none detected, "unsupported" if the API is missing).
export async function blurFacesInImage(url: string): Promise<Blob> {
  const img = await loadImage(url);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FaceBlurError("load-failed", "Couldn't create a canvas.");
  ctx.drawImage(img, 0, 0);

  const detector = getFaceDetector(false);
  let faces: DetectedFace[] = [];
  try {
    faces = await detector.detect(canvas);
  } catch {
    faces = [];
  }
  if (faces.length === 0) {
    throw new FaceBlurError("no-faces", "No faces detected in this image.");
  }
  for (const f of faces) mosaicRegion(ctx, canvas, expand(f.boundingBox, w, h));

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new FaceBlurError("load-failed", "Export failed."))), "image/png"),
  );
}

function pickVideoMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

// Blur faces across a video by playing it through a canvas, mosaicking detected
// faces each frame, and recording the canvas (plus the original audio) to a new
// clip. Processing runs in real time (a 10s clip takes ~10s) and the source
// plays aloud briefly while it records. Returns { blob, mime }.
export async function blurFacesInVideo(
  url: string,
  onProgress?: (fraction: number) => void,
): Promise<{ blob: Blob; mime: string }> {
  const detector = getFaceDetector(true); // fastMode for per-frame speed

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new FaceBlurError("load-failed", "Couldn't load the video."));
  });

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new FaceBlurError("load-failed", "Video has no dimensions.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FaceBlurError("load-failed", "Couldn't create a canvas.");

  const mime = pickVideoMime();
  const canvasStream = canvas.captureStream(30);
  // Carry the original audio across, if the browser exposes it.
  try {
    const el = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const srcStream = el.captureStream ? el.captureStream() : null;
    srcStream?.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
  } catch {
    /* audio best-effort */
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(canvasStream, { mimeType: mime });
  } catch {
    throw new FaceBlurError("record-failed", "This browser can't record the blurred video.");
  }
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  let lastBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  let detecting = false;
  const detectLoop = async () => {
    if (detecting) return;
    detecting = true;
    try {
      const faces = await detector.detect(video);
      lastBoxes = faces.map((f) => expand(f.boundingBox, w, h));
    } catch {
      /* keep last boxes */
    }
    detecting = false;
  };

  recorder.start();
  await video.play();

  await new Promise<void>((resolve) => {
    const frame = () => {
      if (video.ended || video.paused) {
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      void detectLoop(); // async; updates lastBoxes without blocking the draw
      for (const b of lastBoxes) mosaicRegion(ctx, canvas, b);
      if (video.duration) onProgress?.(Math.min(1, video.currentTime / video.duration));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  canvasStream.getTracks().forEach((t) => t.stop());
  const blob = await finished;
  return { blob, mime };
}
