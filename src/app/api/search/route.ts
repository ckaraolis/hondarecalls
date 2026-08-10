import { NextRequest, NextResponse } from "next/server";
import { searchRecalls } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json(
      { error: "Enter a VIN number or registration number." },
      { status: 400 },
    );
  }

  if (q.length < 3) {
    return NextResponse.json(
      { error: "Please enter at least 3 characters." },
      { status: 400 },
    );
  }

  try {
    // Public search never includes surname, first_name, or telephone.
    const results = await searchRecalls(q);
    return NextResponse.json({ query: q, count: results.length, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
