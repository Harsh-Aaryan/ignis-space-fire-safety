import { answerWithGroq, ChatInputError, parseChatRequest } from "@/lib/server/ignis-chat";
import { explainScenario } from "@/services/scenario-assistant";

const MAX_BODY_BYTES = 12_288;
// Best-effort per-instance limit, not a distributed quota across Netlify functions.
const requests = new Map<string, { count: number; expires: number }>();
function allowRequest(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of requests) if (value.expires <= now) requests.delete(key);
  const bucket = requests.get(ip);
  if (bucket && bucket.count >= 10) return false;
  if (bucket) bucket.count++;
  else {
    if (requests.size >= 2000) return false;
    requests.set(ip, { count: 1, expires: now + 60_000 });
  }
  return true;
}
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new ChatInputError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let allowedOrigin = !origin;
  if (origin) {
    try {
      const source = new URL(origin);
      // Next may normalize request.url to its listen hostname behind a proxy.
      allowedOrigin = ["http:", "https:"].includes(source.protocol) && source.host === (request.headers.get("host") ?? new URL(request.url).host);
    } catch { allowedOrigin = false; }
  }
  if (!allowedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "Send questions from the IGNIS app." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Expected JSON." }, 415);
  const ip = request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(ip)) return json({ error: "Too many questions. Please wait a minute." }, 429);
  try {
    const parsed = parseChatRequest(await readBody(request));
    const apiKey = process.env.GROQ_API_KEY;
    const provider = process.env.IGNIS_CHAT_PROVIDER ?? (apiKey ? "groq" : "local");
    if (provider === "groq" && apiKey) {
      return json(await answerWithGroq(parsed, apiKey, process.env.GROQ_MODEL));
    }
    return json({ ...explainScenario(parsed.message, parsed.input, parsed.snapshot), provider: "local",
      ...(provider === "groq" ? { notice: "AI is not configured. Showing a local explanation." } : {}),
    });
  } catch (error) {
    if (error instanceof RangeError) return json({ error: "Question payload is too large." }, 413);
    if (error instanceof SyntaxError || error instanceof ChatInputError) return json({ error: "Invalid question or scenario. Please try again." }, 400);
    return json({ error: "Could not answer. Please try again." }, 500);
  }
}
