import { NextRequest, NextResponse } from "next/server";
import { getAllGenerations, getGeneration, deleteGeneration, getUserFromToken } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    const user = token ? await getUserFromToken(token) : null;

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const generation = await getGeneration(id);
      if (!generation) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 });
      }
      return NextResponse.json(generation);
    }

    const generations = await getAllGenerations(user?.id);
    return NextResponse.json(generations);
  } catch (error) {
    console.error("Failed to fetch generations:", error);
    return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const deleted = await deleteGeneration(id);
    if (!deleted) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete generation:", error);
    return NextResponse.json({ error: "Failed to delete generation" }, { status: 500 });
  }
}
