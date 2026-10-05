import { NextResponse } from "next/server";
import { createOfflinePreview, type OfflineFailure } from "@/lib/offline-demo";
import { isCaseId } from "@/lib/scenarios";

const failures = new Set<OfflineFailure>(["none", "missing-facts", "jev-failure", "supplement-failure"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const caseId = body.caseId;
    const failure = body.failure ?? "none";
    const comparison = body.comparison === true;
    if (!isCaseId(caseId) || typeof failure !== "string" || !failures.has(failure as OfflineFailure)) {
      return NextResponse.json({ error: "Invalid offline fixture selection." }, { status: 400 });
    }
    return NextResponse.json(createOfflinePreview(caseId, comparison, failure as OfflineFailure), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to render the offline fixture." }, { status: 400 });
  }
}
