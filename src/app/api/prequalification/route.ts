import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  initialState,
  requestSchema,
} from "../../../adapters/prequalification/state";
import { processMessage } from "../../../adapters/prequalification/processMessage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_request" } },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "invalid_request" } },
      { status: 400 },
    );
  try {
    const state = parsed.data.state ?? initialState(randomUUID());
    const result = await processMessage(state, {
      id: randomUUID(),
      role: "prospect",
      text: parsed.data.message,
      at: new Date().toISOString(),
    });
    const status = result.ok
      ? 200
      : result.error.code === "invalid_state"
        ? 400
        : result.error.code === "processing_failed"
          ? 500
          : 502;
    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "processing_failed" } },
      { status: 500 },
    );
  }
}
