import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  getUserFromToken,
  createBoardExportJob,
  updateBoardExportJob,
  listBoardExportJobs,
  putFile,
} from "@/lib/db";

// Exports can take a long time when media is large. Bumping maxDuration so the
// after() callback has headroom past the response.
export const maxDuration = 300;
export const runtime = "nodejs";

// GET /api/board-exports — list the user's export jobs (most recent first)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const jobs = await listBoardExportJobs(user.id);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("List board exports error:", error);
    return NextResponse.json({ error: "Failed to load exports" }, { status: 500 });
  }
}

// POST /api/board-exports — create a background export job.
// Body (gzipped JSON or plain JSON): { board: { name, items, connections, panX, panY, zoom } }
//
// The job status returns immediately (`pending`). Next.js's after() then
// continues building the export in the background — fetching every referenced
// URL, base64-embedding the bytes, JSON-serializing the result, and storing
// it as a file in mb_files. Closing the tab doesn't cancel the work.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Parse body (supports gzip for large boards)
    let body: { board?: { name?: string; items?: Array<{ src?: string; outputUrl?: string }> } };
    const encoding = req.headers.get("content-encoding");
    if (encoding === "gzip" && req.body) {
      const decompressed = req.body.pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(decompressed).text();
      body = JSON.parse(text);
    } else {
      body = await req.json();
    }

    const board = body?.board;
    if (!board || !Array.isArray(board.items)) {
      return NextResponse.json({ error: "Missing or invalid board payload" }, { status: 400 });
    }

    const boardName = (board.name || "board").toString();
    const total = board.items.length;
    const job = await createBoardExportJob(user.id, boardName, total);

    // Schedule the heavy work to run AFTER the response is sent. The function
    // keeps running up to maxDuration (300s on Vercel Pro) even if the client
    // disconnects — so the user can close the tab and come back to a finished
    // export.
    after(async () => {
      try {
        await updateBoardExportJob(job.id, { status: "processing", progress: 0 });

        // Deep-clone the items so we can rewrite src/outputUrl to data URIs
        const outItems: unknown[] = [];
        let processed = 0;
        for (const raw of board.items as Array<Record<string, unknown>>) {
          const next: Record<string, unknown> = { ...raw };

          const toDataUri = async (u: unknown): Promise<string> => {
            if (typeof u !== "string" || !u || u.startsWith("data:")) return typeof u === "string" ? u : "";
            try {
              const res = await fetch(u);
              if (!res.ok) return u;
              const buf = Buffer.from(await res.arrayBuffer());
              const mime = res.headers.get("content-type") || "application/octet-stream";
              return `data:${mime};base64,${buf.toString("base64")}`;
            } catch {
              return u;
            }
          };

          if (raw.src) next.src = await toDataUri(raw.src);
          if (raw.outputUrl) next.outputUrl = await toDataUri(raw.outputUrl);

          outItems.push(next);
          processed++;
          // Update progress every ~5 items or on the last one
          if (processed % 5 === 0 || processed === total) {
            await updateBoardExportJob(job.id, { progress: processed });
          }
        }

        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          board: {
            name: boardName,
            items: outItems,
            connections: (board as { connections?: unknown[] }).connections || [],
            panX: (board as { panX?: number }).panX || 0,
            panY: (board as { panY?: number }).panY || 0,
            zoom: (board as { zoom?: number }).zoom || 1,
          },
        };

        const json = JSON.stringify(payload);
        const buffer = Buffer.from(json, "utf-8");
        const { id: fileId } = await putFile(buffer, "application/json", user.id);
        const safeName = boardName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "board";
        const fileName = `${safeName}-${new Date().toISOString().slice(0, 10)}.mbboard.json`;

        await updateBoardExportJob(job.id, {
          status: "completed",
          progress: total,
          fileId,
          fileName,
          error: null,
        });
      } catch (err) {
        console.error("Board export job failed:", err);
        await updateBoardExportJob(job.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Export failed",
        });
      }
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Create board export error:", error);
    return NextResponse.json({ error: "Failed to queue export" }, { status: 500 });
  }
}
