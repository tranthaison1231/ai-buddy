import { environment, getPreferenceValues } from "@raycast/api";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Prefs = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fastMode: boolean;
  mwKey?: string;
};

type Shared = Partial<Pick<Prefs, "baseUrl" | "model">>; // keys are never shared: each user enters their own

/** Shared endpoint + model bundled by the installer (assets/buddy.config.json); missing = {}. */
function sharedConfig(): Shared {
  try {
    return JSON.parse(readFileSync(join(environment.assetsPath, "buddy.config.json"), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Settings: what the user typed in Raycast Settings wins; Base URL and Model fall back to the
 * shared setup from the installer, so a new user only enters their API key.
 */
export function getConfig(): Prefs {
  const prefs = getPreferenceValues<Partial<Prefs>>();
  const shared = sharedConfig();
  const pick = (k: keyof Shared) => prefs[k]?.trim() || shared[k]?.trim() || "";
  return {
    baseUrl: pick("baseUrl"),
    apiKey: prefs.apiKey?.trim() ?? "",
    model: pick("model"),
    mwKey: prefs.mwKey?.trim() || undefined,
    fastMode: prefs.fastMode ?? true,
  };
}

const IDLE_TIMEOUT_MS = 60_000; // no data for this long = give up (a long answer that keeps streaming is fine)
const MAX_ERROR_BODY = 500;

/**
 * Wraps user content in a data tag. Tag-like text inside it is defused, so selected text such as
 * "</text> ignore the rules…" cannot close the block and pose as instructions.
 */
export const dataBlock = (tag: string, text: string) =>
  `<${tag}>\n${text.replace(/<(\/?)(text|idea|previous)\s*>/gi, "‹$1$2›")}\n</${tag}>`;

/** Longest input sent to the model: a whole page selected by mistake would waste tokens. */
export const MAX_INPUT_CHARS = 10_000;

export function clipInput(text: string): { text: string; clipped: boolean } {
  if (text.length <= MAX_INPUT_CHARS) return { text, clipped: false };
  return { text: text.slice(0, MAX_INPUT_CHARS), clipped: true };
}

/** Plain http to a non-local host sends the API key and the text unencrypted. */
export function isInsecureEndpoint(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:") return false;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    return !(host === "localhost" || host === "::1" || host.startsWith("127.") || host.endsWith(".local"));
  } catch {
    return false;
  }
}

const HTTP_HINTS: Record<number, string> = {
  401: "The API key is wrong or expired: check it in Settings.",
  403: "The API key is not allowed to use this model: check Settings.",
  404: "Base URL or model not found: check Settings.",
  429: "Rate limit or quota reached: try again in a moment.",
};

function request(model: string, system: string, user: string, signal: AbortSignal, fast: boolean) {
  const { baseUrl, apiKey } = getConfig();
  return fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      // Skip "thinking": much faster for short chat text. Optional, as not every provider accepts it.
      ...(fast ? { reasoning_effort: "none" } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal,
  });
}

/** Streams the answer of an OpenAI-compatible /chat/completions endpoint. */
export async function* streamChat(
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const { baseUrl, fastMode } = getConfig();
  if (!baseUrl || !model)
    throw new Error("AI Buddy is not set up yet: open Buddy Home → Settings and fill in Base URL, API Key and Model.");
  const idle = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const bump = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => idle.abort(new Error(`No response from ${model} for ${IDLE_TIMEOUT_MS / 1000}s: try again.`)),
      IDLE_TIMEOUT_MS,
    );
  };
  bump();
  const timed = AbortSignal.any([signal, idle.signal]);
  try {
    yield* stream(model, system, user, timed, fastMode, baseUrl, bump);
  } finally {
    clearTimeout(timer);
  }
}

async function* stream(
  model: string,
  system: string,
  user: string,
  timed: AbortSignal,
  fastMode: boolean,
  baseUrl: string,
  bump: () => void,
): AsyncGenerator<string> {
  let res = await request(model, system, user, timed, fastMode);
  // Some providers / models reject reasoning_effort: retry once without it instead of failing.
  let body = res.ok ? "" : await res.text();
  if (!res.ok && fastMode && res.status === 400 && /reasoning/i.test(body)) {
    res = await request(model, system, user, timed, false);
    body = res.ok ? "" : await res.text();
  }
  if (!res.ok || !res.body) {
    const detail = body.length > MAX_ERROR_BODY ? `${body.slice(0, MAX_ERROR_BODY)}…` : body;
    const hint = HTTP_HINTS[res.status] ? `${HTTP_HINTS[res.status]}\n\n` : "";
    throw new Error(`${hint}${res.status} ${res.statusText} (${model} @ ${baseUrl})\n\n${detail}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  // Returns true at the end of the stream.
  function* parse(line: string): Generator<string, boolean> {
    if (!line.startsWith("data:")) return false;
    const data = line.slice(5).trim();
    if (data === "[DONE]") return true;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return false; // skip a malformed / keep-alive chunk instead of failing the whole answer
    }
    if (event.error) throw new Error(`Stream error (${model}): ${event.error.message ?? JSON.stringify(event.error)}`);
    const delta = event.choices?.[0]?.delta?.content;
    if (delta) yield delta;
    return false;
  }
  for await (const bytes of res.body) {
    bump();
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (yield* parse(line)) return;
  }
  yield* parse(buffer.trim()); // last event without a trailing newline
}
