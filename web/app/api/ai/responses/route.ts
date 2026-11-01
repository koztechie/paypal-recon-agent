import { aiModels, openAiKey } from '@/lib/ai';
import { guardStudioAi, validateAiBody } from '@/lib/ai-limits';

// Proxy for AG Studio's OpenAI adapter (app/dashboard/studio/openai-adapter.ts). The adapter
// runs in the browser and POSTs to `${endpoint}/responses`; with its endpoint set to /api/ai it lands
// here. This adds the server's OpenAI key (see lib/ai.ts), forwards the body to the OpenAI Responses API and
// streams the SSE reply straight back, so the adapter works unchanged and the key never leaves the
// server.
//
// Security C-5 (fixed 2026-11-01): the edge is hard before the key is touched —
//   * LOCAL ONLY (Origin/Host): an evil page in the user's browser carries its own
//     Origin and text/plain POSTs skip the preflight, so Origin/Host is the check
//     that stops credit-burn; a non-local Host means web/ got deployed — refuse.
//   * BOUNDED body: streamed read capped at64 KB (Content-Length pre-checked),
//     `messages` must be an array of ≤50 entries (see web/lib/ai-limits.ts).

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

// Bounds the cost of a single turn, whatever the client asks for. Reasoning tokens count towards it.
const MAX_OUTPUT_TOKENS = 32_000;
const MAX_BODY_CHARS = 64 * 1024;

const error = (status: number, message: string) => Response.json({ error: { message } }, { status });

export async function POST(request: Request) {
  const guard = guardStudioAi(
    request.headers.get('origin') ?? undefined,
    request.headers.get('host') ?? undefined,
  );
  if (!guard.ok) return error(guard.status, guard.message);

  // Streamed read with a hard cap — never buffer an unbounded body into memory.
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) {
    return error(413, `Request body exceeds ${MAX_BODY_CHARS} bytes.`);
  }
  const reader = request.body?.getReader();
  let raw = '';
  if (reader) {
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      if (raw.length > MAX_BODY_CHARS) {
        try {
          await reader.cancel();
        } catch {
          /* already closed */
        }
        return error(413, `Request body exceeds ${MAX_BODY_CHARS} bytes.`);
      }
    }
  }
  const parsed = validateAiBody(raw);
  if (!parsed.ok) return error(parsed.status, parsed.message);
  const body = parsed.body;

  const apiKey = openAiKey();
  if (!apiKey) return error(503, 'The AI assistant is not configured: set AG_STUDIO_OPENAI_API_KEY in .env.local.');

  // Only the models offered in the picker (OPENAI_MODELS) may be called.
  const models = aiModels();
  const model = typeof body.model === 'string' && body.model ? body.model : models[0];
  if (!models.includes(model)) return error(400, `Model "${model}" is not enabled.`);

  const upstream = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model, max_output_tokens: MAX_OUTPUT_TOKENS }),
    // Stopping the chat in Studio aborts the browser request, which cancels this one too.
    signal: request.signal,
  });

  // Errors come back as JSON and the adapter reads `error.message` from them; success is an SSE stream.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
