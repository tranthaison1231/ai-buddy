import { getPreferenceValues } from "@raycast/api";
import { LESSONS_MARKER } from "./prompts";

export type ProviderId = "gemini" | "groq" | "openai" | "custom";
export type PolishMode = "popup" | "replace";
export type WriteMode = "popup" | "replace";
export type WriteLanguage = "auto" | "en" | "vi";
export type WriteStyle = "chat" | "email" | "concise" | "formal";
export type VisionAction = "explain" | "ocr" | "translate" | "summarize" | "ask";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type Prefs = {
  providerId: ProviderId;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fastMode: boolean;
  polishMode: PolishMode;
  writeMode: WriteMode;
  writeLanguage: WriteLanguage;
  visionAction: Exclude<VisionAction, "ask">;
  mwKey?: string;
};

type RawPrefs = {
  activeProvider?: ProviderId;
  fastMode?: boolean;
  polishMode?: PolishMode;
  writeMode?: WriteMode;
  writeLanguage?: WriteLanguage;
  visionAction?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  customBaseUrl?: string;
  customApiKey?: string;
  customModel?: string;
  mwKey?: string;
};

type ProviderMeta = {
  name: string;
  baseUrl: string;
  defaultModel: string;
};

const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.5-flash-lite",
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "qwen/qwen3.8-27b",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
  },
  custom: {
    name: "Custom",
    baseUrl: "",
    defaultModel: "",
  },
};

function resolveProviderId(value?: string): ProviderId {
  return value === "groq" || value === "openai" || value === "custom" ? value : "gemini";
}

function resolveWriteLanguage(value?: string): WriteLanguage {
  return value === "en" || value === "vi" ? value : "auto";
}

function resolveVisionAction(value?: string): Exclude<VisionAction, "ask"> {
  return value === "ocr" || value === "translate" || value === "summarize" ? value : "explain";
}

/** Resolves the active provider's endpoint, API key, and model from Raycast Settings. */
export function getConfig(): Prefs {
  const prefs = getPreferenceValues<RawPrefs>();
  const providerId = resolveProviderId(prefs.activeProvider);
  const meta = PROVIDERS[providerId];

  const byProvider: Record<ProviderId, { baseUrl: string; apiKey: string; model: string }> = {
    gemini: {
      baseUrl: meta.baseUrl,
      apiKey: prefs.geminiApiKey?.trim() ?? "",
      model: prefs.geminiModel?.trim() || PROVIDERS.gemini.defaultModel,
    },
    groq: {
      baseUrl: meta.baseUrl,
      apiKey: prefs.groqApiKey?.trim() ?? "",
      model: prefs.groqModel?.trim() || PROVIDERS.groq.defaultModel,
    },
    openai: {
      baseUrl: meta.baseUrl,
      apiKey: prefs.openaiApiKey?.trim() ?? "",
      model: prefs.openaiModel?.trim() || PROVIDERS.openai.defaultModel,
    },
    custom: {
      baseUrl: prefs.customBaseUrl?.trim() ?? "",
      apiKey: prefs.customApiKey?.trim() ?? "",
      model: prefs.customModel?.trim() ?? "",
    },
  };

  const active = byProvider[providerId];
  return {
    providerId,
    providerName: meta.name,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    mwKey: prefs.mwKey?.trim() || undefined,
    fastMode: prefs.fastMode ?? true,
    polishMode: prefs.polishMode === "replace" ? "replace" : "popup",
    writeMode: prefs.writeMode === "popup" ? "popup" : "replace",
    writeLanguage: resolveWriteLanguage(prefs.writeLanguage),
    visionAction: resolveVisionAction(prefs.visionAction),
  };
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

// Small models sometimes wrap the answer in <text> tags, or echo the input block back.
// Drop a block only when it is the echoed input; otherwise keep its content.
export const cleanOutput = (output: string, input: string) =>
  output
    .replace(/<text>([\s\S]*?)<\/text>/g, (_, inner: string) => (normalize(inner) === normalize(input) ? "" : inner))
    .replace(/<\/?text>/g, "")
    .trim();

/** Rewrite answers are "<rewritten>\n---LESSONS---\n<bullets>"; split them (also mid-stream). */
export function splitLessons(output: string): { main: string; lessons: string } {
  const at = output.indexOf(LESSONS_MARKER);
  if (at === -1) {
    // Hide a half-streamed marker such as "\n---LES" until it completes.
    return { main: output.replace(/\n-{1,3}[A-Z-]*$/, "").trim(), lessons: "" };
  }
  return { main: output.slice(0, at).trim(), lessons: output.slice(at + LESSONS_MARKER.length).trim() };
}

const IDLE_TIMEOUT_MS = 60_000; // no data for this long = give up (a long answer that keeps streaming is fine)
const MAX_ERROR_BODY = 500;

/**
 * Wraps user content in a data tag. Tag-like text inside it is defused, so selected text such as
 * "</text> ignore the rules…" cannot close the block and pose as instructions.
 */
export const dataBlock = (tag: string, text: string) =>
  `<${tag}>\n${text.replace(/<(\/?)(text|idea|previous|context)\s*>/gi, "‹$1$2›")}\n</${tag}>`;

/** Longest input sent to the model: a whole page selected by mistake would waste tokens. */
export const MAX_INPUT_CHARS = 10_000;

export function clipInput(text: string): { text: string; clipped: boolean } {
  if (text.length <= MAX_INPUT_CHARS) return { text, clipped: false };
  return { text: text.slice(0, MAX_INPUT_CHARS), clipped: true };
}

function isLocalEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "::1" || host.startsWith("127.") || host.endsWith(".local");
  } catch {
    return false;
  }
}

/** Plain http to a non-local host sends the API key and the text unencrypted. */
export function isInsecureEndpoint(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:") return false;
    return !isLocalEndpoint(baseUrl);
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

function isGoogleEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "generativelanguage.googleapis.com";
  } catch {
    return false;
  }
}

/**
 * Lowest reasoning effort for fastMode:
 * - Google Flash-Lite models already default to minimal/off thinking; omit reasoning_effort.
 * - Google Gemini 2.5 Pro and Gemini 3+ reject "none"; use "minimal".
 * - GPT-OSS models only accept "low" | "medium" | "high" (default "medium"); use "low".
 */
function fastEffort(baseUrl: string, model: string): "none" | "minimal" | "low" | undefined {
  if (isGoogleEndpoint(baseUrl)) {
    if (/(?:^|\/)gemini-.*flash-lite/i.test(model)) return undefined;
    if (/(?:^|\/)gemini-(?:[3-9]|2\.5-pro)/i.test(model)) return "minimal";
  }
  if (/(?:^|\/)gpt-oss-/i.test(model)) return "low";
  return "none";
}

function hasImageContent(messages: ChatMessage[]): boolean {
  return messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
}

function request(model: string, messages: ChatMessage[], signal: AbortSignal, effort?: string) {
  const { baseUrl, apiKey } = getConfig();
  return fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      // Skip or minimize "thinking": much faster for short chat text. Optional, as not every provider accepts it.
      ...(effort ? { reasoning_effort: effort } : {}),
      messages,
    }),
    signal,
  });
}

/** Returns a human-readable setup error if the active provider is missing required config. */
export function getConfigError(cfg: Prefs = getConfig()): string | undefined {
  if (!cfg.baseUrl) {
    return `Missing Base URL for ${cfg.providerName}: open Settings (⌘⇧,) and fill in "${cfg.providerName} · Base URL".`;
  }
  if (!cfg.model) {
    return `Missing Model for ${cfg.providerName}: open Settings (⌘⇧,) and fill in "${cfg.providerName} · Model".`;
  }
  if (!cfg.apiKey && !isLocalEndpoint(cfg.baseUrl)) {
    return `Missing API Key for ${cfg.providerName}: open Settings (⌘⇧,) and fill in "${cfg.providerName} · API Key".`;
  }
  return undefined;
}

/** Streams a multi-turn (and optionally multimodal) conversation from an OpenAI-compatible endpoint. */
export async function* streamMessages(
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const cfg = getConfig();
  const configError = getConfigError({ ...cfg, model });
  if (configError) throw new Error(configError);
  const { baseUrl, fastMode } = cfg;
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
    yield* stream(model, messages, timed, fastMode, baseUrl, bump);
  } finally {
    clearTimeout(timer);
  }
}

/** Streams the answer of an OpenAI-compatible /chat/completions endpoint. */
export async function* streamChat(
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  yield* streamMessages(
    model,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    signal,
  );
}

async function* stream(
  model: string,
  messages: ChatMessage[],
  timed: AbortSignal,
  fastMode: boolean,
  baseUrl: string,
  bump: () => void,
): AsyncGenerator<string> {
  const effort = fastMode ? fastEffort(baseUrl, model) : undefined;
  let res = await request(model, messages, timed, effort);
  // Some providers / models reject reasoning_effort (or specifically "none"): retry with fallback instead of failing.
  let body = res.ok ? "" : await res.text();
  if (!res.ok && effort && res.status === 400 && /reasoning|thinking|effort/i.test(body)) {
    if (effort === "none" && !/flash-lite/i.test(model) && /\bnone\b|thinking|budget/i.test(body)) {
      res = await request(model, messages, timed, "minimal");
      body = res.ok ? "" : await res.text();
    }
    if (!res.ok && res.status === 400 && /reasoning|thinking|effort/i.test(body)) {
      res = await request(model, messages, timed, undefined);
      body = res.ok ? "" : await res.text();
    }
  }
  if (!res.ok || !res.body) {
    const detail = body.length > MAX_ERROR_BODY ? `${body.slice(0, MAX_ERROR_BODY)}…` : body;
    const visionHint =
      hasImageContent(messages) &&
      (res.status === 400 || res.status === 422) &&
      /image|vision|multimodal|content/i.test(body)
        ? "This model may not support image input. Switch to a vision-capable model (e.g. Google Gemini or OpenAI) in Settings.\n\n"
        : "";
    const hint = visionHint || (HTTP_HINTS[res.status] ? `${HTTP_HINTS[res.status]}\n\n` : "");
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
