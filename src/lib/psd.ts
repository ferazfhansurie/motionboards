import { readPsd, writePsd, type Psd, type Layer } from "ag-psd";
import type { BoardItem } from "./store";

export interface ParsedPsdLayer {
  name: string;
  dataUrl: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  blendMode: string;
  hidden: boolean;
  order: number;
}

export interface ParsedPsd {
  width: number;
  height: number;
  layers: ParsedPsdLayer[];
}

function flattenLayers(
  layers: Layer[],
  prefix: string,
  result: ParsedPsdLayer[],
  counter: { n: number }
) {
  for (const layer of layers) {
    const name = prefix ? `${prefix}/${layer.name || "Untitled"}` : layer.name || "Untitled";

    // If it has children (group), recurse
    if (layer.children && layer.children.length > 0) {
      flattenLayers(layer.children, name, result, counter);
      continue;
    }

    // Skip layers without canvas data
    if (!layer.canvas) continue;

    const canvas = layer.canvas as HTMLCanvasElement | OffscreenCanvas;
    let dataUrl: string;

    if ("toDataURL" in canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else {
      // OffscreenCanvas — convert via blob synchronously isn't possible,
      // so we transfer to a regular canvas
      const c = document.createElement("canvas");
      c.width = canvas.width;
      c.height = canvas.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(canvas as OffscreenCanvas, 0, 0);
      dataUrl = c.toDataURL("image/png");
    }

    result.push({
      name,
      dataUrl,
      left: layer.left || 0,
      top: layer.top || 0,
      width: (layer.right || canvas.width) - (layer.left || 0),
      height: (layer.bottom || canvas.height) - (layer.top || 0),
      opacity: layer.opacity !== undefined ? Math.round(layer.opacity * 255) : 255,
      blendMode: layer.blendMode || "normal",
      hidden: layer.hidden || false,
      order: counter.n++,
    });
  }
}

export function parsePsdBuffer(buffer: ArrayBuffer): ParsedPsd {
  const psd = readPsd(buffer);

  const layers: ParsedPsdLayer[] = [];
  if (psd.children) {
    flattenLayers(psd.children, "", layers, { n: 0 });
  }

  return {
    width: psd.width,
    height: psd.height,
    layers,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function buildPsdFromItems(
  items: BoardItem[],
  canvasWidth: number,
  canvasHeight: number
): Promise<ArrayBuffer> {
  const children: Layer[] = [];

  for (const item of items) {
    const imgSrc = item.outputUrl || item.src;
    if (!imgSrc) continue;

    const img = await loadImage(imgSrc);

    const canvas = document.createElement("canvas");
    canvas.width = item.width;
    canvas.height = item.height;
    const ctx = canvas.getContext("2d")!;

    // Apply edit state filters if present
    if (item.editState) {
      const { brightness, contrast, saturate, hueRotate } = item.editState;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg)`;
    }

    // Apply crop if present
    if (item.editState && (item.editState.cropW < 1 || item.editState.cropH < 1)) {
      const { cropX, cropY, cropW, cropH } = item.editState;
      ctx.drawImage(
        img,
        cropX * img.naturalWidth,
        cropY * img.naturalHeight,
        cropW * img.naturalWidth,
        cropH * img.naturalHeight,
        0, 0, item.width, item.height
      );
    } else {
      ctx.drawImage(img, 0, 0, item.width, item.height);
    }

    children.push({
      name: item.psdLayerName || item.fileName || item.prompt || `Layer ${children.length + 1}`,
      canvas: canvas as unknown as HTMLCanvasElement,
      left: Math.round(item.x),
      top: Math.round(item.y),
      right: Math.round(item.x + item.width),
      bottom: Math.round(item.y + item.height),
      opacity: item.psdOpacity !== undefined ? item.psdOpacity / 255 : 1,
      blendMode: (item.psdBlendMode as Layer["blendMode"]) || "normal",
      hidden: false,
    });
  }

  const psd: Psd = {
    width: canvasWidth,
    height: canvasHeight,
    children,
  };

  return writePsd(psd);
}

export function downloadPsd(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".psd") ? filename : `${filename}.psd`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
