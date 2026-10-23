import type { NextRequest } from "next/server";

export async function readJson(request: NextRequest, limit = 4096): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") ?? 0) > limit) throw new Error("invalid_input");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_input");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("invalid_input"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch { throw new Error("invalid_input"); }
  finally { reader.releaseLock(); }
}
