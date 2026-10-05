import { NextResponse } from "next/server";
import { validateLiveConfig } from "@/lib/live-config";

export async function GET() {
  const gate = validateLiveConfig(process.env);
  return NextResponse.json({ ready: gate.ok, status: gate.ok ? "explicitly configured" : "locked" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
