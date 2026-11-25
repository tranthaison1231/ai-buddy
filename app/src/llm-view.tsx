import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  Keyboard,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  cleanOutput,
  clipInput,
  dataBlock,
  getConfig,
  isInsecureEndpoint,
  MAX_INPUT_CHARS,
  splitLessons,
  streamChat,
} from "./llm";
import { getCachedLookup, isLookupText, parseLookup, setCachedLookup } from "./lookup";
import { getLanguage, ui } from "./i18n";
import { systemPrompt, Target } from "./prompts";
import { cambridgeUrl, loadPronunciations, Pron, speak } from "./pronounce";

export type Mode = "translate" | "reply" | "rewrite" | "summarize";
/** Passed from the no-view launcher; startedAt is the hotkey press time (epoch ms). */
export type LLMRequest = { mode: Mode; text: string; startedAt: number };

const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
// Common words of Vietnamese typed without diacritics (avoiding ones that are also common English words).
const VIETNAMESE_PLAIN_WORDS = new Set(
  (
    "ai co ko k khong hok vo vao o tren duoi nhe nha oi anh em chi minh dc duoc roi chua gi sao nao la cua cho voi " +
    "va thi nhung neu khi de lam phai xong di den ve nay kia hom mai sang chieu toi giup nho luon lien het dang se " +
    "da bi cung con ban biet thay muon hoi tra loi gui xem coi nua thoi vay nhi"
  ).split(" "),
);

/** Vietnamese with or without diacritics, possibly mixed with English work terms. */
export function isVietnamese(text: string): boolean {
  if (VIETNAMESE_DIACRITICS.test(text)) return true;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((w) => VIETNAMESE_PLAIN_WORDS.has(w)).length;
  // Need several hits, so an English sentence with a Vietnamese name or two stays English.
  return hits >= 3 || (hits >= 2 && hits / words.length >= 0.25) || (words.length <= 3 && hits / words.length >= 0.5);
}
/** The one placeholder used everywhere something is still on its way. */
const LOADING = "⏳ Loading…";

function buildPrompt(mode: Mode, text: string, targetOverride?: Target): { title: string; system: string } {
  if (mode === "translate") {
    const target = isVietnamese(text) ? "English" : "Vietnamese";
    const title = target === "English" ? "🇬🇧 EN" : "🇻🇳 VI";
    // A word or short phrase is a dictionary lookup: meanings, usage and examples in one streamed answer.
    return { title, system: systemPrompt(isLookupText(text) ? "lookup" : "translate", target) };
  }
  if (mode === "summarize") {
    const target: Target = targetOverride ?? (getLanguage() === "en" ? "English" : "Vietnamese");
    return { title: "📋 Summary", system: systemPrompt("summarize", target) };
  }
  return mode === "rewrite"
    ? { title: "✨ Polished", system: systemPrompt("rewrite") }
    : { title: "💬 Reply", system: systemPrompt("reply") };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Markdown from the model is rendered by Raycast, which loads remote images by itself. A prompt
 * injected through the selected text could make the model emit an image URL carrying private text
 * to someone else's server, so images are removed before rendering.
 */
export const stripImages = (markdown: string) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
    .replace(/<img\b[^>]*>/gi, "");

const settingsAction = (
  <Action
    title="Open Settings"
    icon={Icon.Gear}
    shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
    onAction={openExtensionPreferences}
  />
);

type Lesson = { wrong?: string; right?: string; why: string };

/**
 * Lesson bullets look like "- `wrong` → `right`: explanation". Keep only lessons about phrases
 * that really appear in my draft (small models sometimes "correct" text added from the idea).
 */
function parseLessons(lessons: string, original: string): Lesson[] {
  const draft = normalize(original).toLowerCase();
  return lessons
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((l): Lesson => {
      const m = l.match(/^`([^`]+)`\s*→\s*`([^`]+)`\s*:?\s*(.*)$/);
      return m ? { wrong: m[1], right: m[2], why: m[3] } : { why: l.replace(/`/g, "") };
    })
    .filter((l) => !l.wrong || draft.includes(normalize(l.wrong).toLowerCase()));
}

type Run = { id: number; at: number; idea: string; previous: string; target?: Target };

/**
 * Streams one LLM answer. Re-runs on a new selection, or via regenerate(idea, previous, target):
 * with `previous` the model revises that version instead of starting from scratch.
 */
function useLLM({ mode, text, startedAt }: LLMRequest) {
  const { model } = getConfig();
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string>();
  const [totalMs, setTotalMs] = useState<number>();
  const [run, setRun] = useState<Run>({ id: 0, at: startedAt, idea: "", previous: "" });
  // Read once per request (custom prompts come from a file), not on every loading tick.
  const { title, system } = useMemo(() => buildPrompt(mode, text, run.target), [mode, text, run.target]);

  // A new selection starts a fresh run (Raycast may reuse this view).
  useEffect(() => {
    setRun((r) => (r.id === 0 && r.at === startedAt ? r : { id: 0, at: startedAt, idea: "", previous: "" }));
  }, [mode, text, startedAt]);

  // Dictionary lookups are cached whole: a word looked up before shows instantly (⌘R still regenerates).
  const cacheable = mode === "translate" && isLookupText(text);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setOutput("");
    setError(undefined);
    setTotalMs(undefined);
    setFromCache(false);
    const cached = cacheable && run.id === 0 ? getCachedLookup(text, system) : undefined;
    if (cached) {
      setOutput(cached);
      setFromCache(true);
      setTotalMs(0);
      return;
    }
    const user =
      dataBlock("text", text) +
      (run.previous ? `\n${dataBlock("previous", run.previous)}` : "") +
      (run.idea ? `\n${dataBlock("idea", run.idea)}` : "");
    (async () => {
      try {
        let full = "";
        for await (const chunk of streamChat(model, system, user, controller.signal)) {
          full += chunk;
          setOutput((prev) => prev + chunk);
        }
        if (cacheable && full.trim()) setCachedLookup(text, system, full);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!controller.signal.aborted) setTotalMs(Date.now() - run.at);
      }
    })();
    return () => controller.abort();
  }, [run]);

  // Tick a live elapsed counter while waiting.
  const [now, setNow] = useState(Date.now());
  const isLoading = totalMs === undefined;
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isLoading]);

  const cleaned = cleanOutput(output, text);
  const { main: result, lessons } = mode === "rewrite" ? splitLessons(cleaned) : { main: cleaned, lessons: "" };
  const regenerate = (idea = "", previous = "", target?: Target) =>
    setRun((r) => ({ id: r.id + 1, at: Date.now(), idea, previous, target: target ?? r.target }));

  return {
    title,
    result,
    lessons,
    error,
    isLoading,
    isRevision: run.previous !== "",
    regenerate,
    pending: `${LOADING} ${seconds(Math.max(0, now - run.at))}`,
    // Shown bottom-left in every view: Loading while running, then the response time only.
    navigationTitle: totalMs === undefined ? LOADING : fromCache ? "⚡ cached" : `⏱ ${seconds(totalMs)}`,
  };
}

/**
 * Reply / Rewrite: a form to tweak the answer, or type an idea and press Enter to revise the
 * current version (edits included). Without an idea, Enter copies (Reply) or replaces the
 * still-selected draft (Rewrite).
 */
function EditableForm(request: LLMRequest) {
  const t = ui();
  const isRewrite = request.mode === "rewrite";
  const llm = useLLM(request);
  const [answer, setAnswer] = useState(""); // editable copy of the streamed answer
  const [idea, setIdea] = useState("");
  const [applied, setApplied] = useState<string[]>([]); // ideas applied so far
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => setAnswer(llm.result), [llm.result]);
  useEffect(() => {
    setIdea("");
    setApplied([]);
    setLessons([]);
  }, [request.text, request.startedAt]);
  // Lessons are about my original draft, so keep the ones from the first (non-revision) run.
  useEffect(() => {
    if (!llm.isRevision && !llm.isLoading) setLessons(parseLessons(llm.lessons, request.text));
  }, [llm.isRevision, llm.isLoading, llm.lessons]);

  const hasIdea = idea.trim() !== "";
  const revise = () => {
    const next = idea.trim();
    setApplied((list) => [...list, next]);
    setIdea("");
    llm.regenerate(next, answer);
  };
  const startOver = () => {
    setApplied([]);
    setIdea("");
    llm.regenerate();
  };

  const copy = (
    <Action.CopyToClipboard
      title={isRewrite ? "Copy" : "Copy Reply"}
      icon={Icon.Clipboard}
      content={answer}
      shortcut={Keyboard.Shortcut.Common.Copy}
    />
  );
  // Rewrite: the draft is still selected in the chat box, so pasting replaces it.
  const paste = (
    <Action.Paste
      title={isRewrite ? "Replace Draft" : "Paste in Active App"}
      content={answer}
      shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
    />
  );
  const [primary, secondary] = isRewrite ? [paste, copy] : [copy, paste];

  return (
    <Form
      isLoading={llm.isLoading}
      navigationTitle={llm.navigationTitle}
      actions={
        <ActionPanel>
          {hasIdea && <Action title="Apply Idea" icon={Icon.Wand} onAction={revise} />}
          {answer && primary}
          {answer && secondary}
          {llm.error && settingsAction}
          <Action
            title="Start over"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={startOver}
          />
        </ActionPanel>
      }
    >
      <Form.Description title={isRewrite ? "📝 Original" : "❓ Question"} text={request.text} />
      {llm.error ? (
        <Form.Description title="⚠️ Error" text={llm.error} />
      ) : (
        <Form.TextArea
          id="answer"
          title={llm.title}
          value={answer}
          onChange={setAnswer}
          placeholder={llm.isLoading ? llm.pending : "(empty response)"}
        />
      )}
      <Form.TextField
        id="idea"
        title="💡 Idea"
        value={idea}
        onChange={setIdea}
        placeholder={t.ideaPlaceholder[isRewrite ? "rewrite" : "reply"]}
      />
      {applied.length > 0 && <Form.Description title="" text={`${t.applied}: ${applied.join(" → ")}`} />}
      {lessons.length > 0 && <Form.Separator />}
      {/* Form.Description collapses newlines, so each lesson gets its own rows. */}
      {lessons.flatMap((l, i) => {
        const title = i === 0 ? "📘 Lessons" : "";
        return l.wrong
          ? [
              <Form.Description key={`${i}-fix`} title={title} text={`✗ ${l.wrong}   →   ✓ ${l.right}`} />,
              <Form.Description key={`${i}-why`} title="" text={`↳ ${l.why}`} />,
            ]
          : [<Form.Description key={`${i}-why`} title={title} text={l.why} />];
      })}
    </Form>
  );
}

/** Pronunciation for the English side of a finished translation (source or result). */
function usePronunciation(english: string | undefined) {
  const [items, setItems] = useState<Pron[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setItems([]);
    if (!english) return setIsLoading(false);
    const controller = new AbortController();
    setIsLoading(true);
    loadPronunciations(english, controller.signal, (list) => {
      if (!controller.signal.aborted) setItems(list.filter((p) => p.ipa));
    })
      .catch(() => undefined)
      .finally(() => !controller.signal.aborted && setIsLoading(false));
    return () => {
      controller.abort();
      setIsLoading(false);
    };
  }, [english]);
  return { items, isLoading };
}

/** Usage + examples section of a dictionary card. */
function usageMarkdown({
  context,
  phrases,
  examples,
}: {
  context: string;
  phrases: string[];
  examples: { en: string; ipa: string; vi: string }[];
}) {
  if (!context && !phrases.length && !examples.length) return "";
  const t = ui();
  const parts = ["---"];
  if (context) parts.push(`#### ${t.usage}`, context);
  if (phrases.length) parts.push(`**${t.phrases}:** ${phrases.map((c) => `\`${c}\``).join("  ")}`);
  if (examples.length) {
    const keys = examples.map((_, i) => `⌘${i + 1}`).join(" · ");
    parts.push(`#### ${t.examples}\n\n_🔊 ${t.listenHint(keys)}_`);
    // One paragraph per example: English, its IPA, then Vietnamese. "  \n" is a hard line break so lines can't merge.
    parts.push(
      ...examples.map((e, i) =>
        [`**${i + 1}.** ${e.en}`, e.ipa && `🗣 ${e.ipa}`, e.vi && `↳ _${e.vi}_`].filter(Boolean).join("  \n"),
      ),
    );
  }
  return parts.join("\n\n");
}

async function play(action: () => Promise<void>) {
  try {
    await action();
  } catch (e) {
    await showToast({ style: Toast.Style.Failure, title: "Cannot play audio", message: String(e) });
  }
}

/** Translate: a read-only markdown view, plus pronunciation of the English side. */
function ResultDetail(request: LLMRequest) {
  const t = ui();
  const llm = useLLM(request);
  const toEnglish = isVietnamese(request.text);
  // A word / short phrase in either language is a dictionary lookup (same rule as the translate prompt).
  const isLookup = isLookupText(request.text);
  const safeResult = stripImages(llm.result);
  const lookup = isLookup ? parseLookup(safeResult) : undefined;
  // English side: the source when translating EN→VI, the result when VI→EN.
  // For a VI→EN lookup use the first English meaning as soon as the MEANING line is complete.
  const english = toEnglish
    ? lookup
      ? lookup.meaningDone
        ? lookup.meaning.split(/[;,]/)[0].trim()
        : undefined
      : llm.isLoading
        ? undefined
        : llm.result
    : request.text;
  const pron = usePronunciation(llm.error ? undefined : english);
  const first = pron.items[0];
  const copyText = lookup ? lookup.meaning : llm.result; // copy the raw text; only rendering is sanitized

  // Word / short phrase: one dictionary card, sections appear as they arrive, a single Loading line at the end.
  //   ## security
  //   (n) /sɪˈkjɚrəti/
  //   bảo mật; an ninh; sự an toàn
  //   --- Usage · Common phrases · Examples
  const ipaLines = pron.items.map((p) => `${p.pos ? `**(${p.pos})** ` : ""}\`${p.ipa}\``).join("  \n");
  const stillLoading = llm.isLoading || pron.isLoading;
  const card = lookup
    ? [
        `## ${request.text}`,
        toEnglish ? lookup.meaning : ipaLines, // VI→EN: IPA belongs to the English meaning, shown after it
        toEnglish ? ipaLines : lookup.meaning,
        usageMarkdown(lookup),
        stillLoading ? `_${LOADING}_` : !lookup.meaning ? "_(empty response)_" : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";
  const result = safeResult || (llm.isLoading ? `_${llm.pending}_` : "_(empty response)_");

  // Sentence: translation first and prominent, the original quoted underneath, vocabulary on the side.
  const quoted = request.text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const markdown = llm.error
    ? `## ⚠️ Error\n\n\`\`\`\n${llm.error}\n\`\`\``
    : isLookup
      ? card
      : `${result}\n\n---\n\n${quoted}`;

  const metadata = !llm.error && !isLookup && (
    <Detail.Metadata>
      <Detail.Metadata.Label title={t.direction} text={toEnglish ? t.toEnglish : t.toVietnamese} />
      <Detail.Metadata.Separator />
      {pron.items.length > 0 ? (
        <>
          <Detail.Metadata.Label title={t.vocabulary} />
          {pron.items.map((p, i) => (
            <Detail.Metadata.Label
              key={`${p.word}-${i}`}
              title={`${p.word}${p.pos ? ` (${p.pos})` : ""}`}
              text={p.meaning ? `${p.ipa} · ${p.meaning}` : p.ipa}
            />
          ))}
        </>
      ) : (
        <Detail.Metadata.Label title={t.vocabulary} text={pron.isLoading ? LOADING : "—"} />
      )}
    </Detail.Metadata>
  );

  return (
    <Detail
      isLoading={llm.isLoading || pron.isLoading}
      navigationTitle={llm.navigationTitle}
      markdown={markdown}
      metadata={metadata || undefined}
      actions={
        <ActionPanel>
          {/* One rule everywhere: Enter copies, ⌘L listens. */}
          {llm.error && settingsAction}
          {copyText && <Action.CopyToClipboard content={copyText} />}
          {english && (
            <Action
              title="Listen"
              icon={Icon.SpeakerHigh}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
              onAction={() => play(() => speak(english))}
            />
          )}
          {copyText && <Action.Paste content={copyText} shortcut={{ modifiers: ["cmd", "shift"], key: "v" }} />}
          {lookup?.examples.map((e, i) => (
            <Action
              key={`ex-${i}`}
              title={`Listen Example ${i + 1}`}
              icon={Icon.SpeakerOn}
              shortcut={{ modifiers: ["cmd"], key: String(i + 1) as "1" | "2" | "3" }}
              onAction={() => play(() => speak(e.en.replace(/\*\*/g, "")))}
            />
          ))}
          {english && (
            <Action
              title="Listen Slowly"
              icon={Icon.SpeakerLow}
              shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
              onAction={() => play(() => speak(english, true))}
            />
          )}
          {first && (
            <Action.OpenInBrowser
              title="Open in Cambridge"
              url={cambridgeUrl(first.word)}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
          )}
          <Action
            title="Regenerate"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => llm.regenerate()}
          />
        </ActionPanel>
      }
    />
  );
}

/** Summarize: structured Markdown TL;DR, Key Points, and Action Items with 1-key language toggle. */
function SummarizeDetail(request: LLMRequest) {
  const t = ui();
  const { providerName, model } = getConfig();
  const defaultTarget: Target = getLanguage() === "en" ? "English" : "Vietnamese";
  const [target, setTarget] = useState<Target>(defaultTarget);
  const llm = useLLM(request);

  useEffect(() => {
    setTarget(getLanguage() === "en" ? "English" : "Vietnamese");
  }, [request.text, request.startedAt]);

  const nextTarget: Target = target === "English" ? "Vietnamese" : "English";
  const safeResult = stripImages(llm.result);
  const markdown = llm.error
    ? `## ⚠️ Error\n\n\`\`\`\n${llm.error}\n\`\`\``
    : safeResult || (llm.isLoading ? `_${llm.pending}_` : "_(empty response)_");

  const wordCount = request.text.trim() ? request.text.trim().split(/\s+/).length : 0;
  const metadata = !llm.error && (
    <Detail.Metadata>
      <Detail.Metadata.Label title={t.summaryLanguage} text={target === "English" ? "English" : "Tiếng Việt"} />
      <Detail.Metadata.Label title={t.originalLength} text={t.formatLength(wordCount, request.text.length)} />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label title="Provider" text={providerName} />
      <Detail.Metadata.Label title="Model" text={model || "—"} />
    </Detail.Metadata>
  );

  return (
    <Detail
      isLoading={llm.isLoading}
      navigationTitle={llm.navigationTitle}
      markdown={markdown}
      metadata={metadata || undefined}
      actions={
        <ActionPanel>
          {llm.error && settingsAction}
          {llm.result && <Action.CopyToClipboard title="Copy Summary" content={llm.result} />}
          {llm.result && <Action.Paste content={llm.result} shortcut={{ modifiers: ["cmd", "shift"], key: "v" }} />}
          <Action
            title={nextTarget === "English" ? "Summarize in English" : "Summarize in Tiếng Việt"}
            icon={Icon.Globe}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={() => {
              setTarget(nextTarget);
              llm.regenerate("", "", nextTarget);
            }}
          />
          <Action
            title="Regenerate"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => llm.regenerate()}
          />
          {!llm.error && settingsAction}
        </ActionPanel>
      }
    />
  );
}

export function LLMView(request: LLMRequest) {
  const { text, clipped } = clipInput(request.text);
  // Warnings, once per request: an oversized input was cut, or the endpoint is unencrypted.
  useEffect(() => {
    const t = ui();
    const warnings = [
      clipped && t.clipped(MAX_INPUT_CHARS.toLocaleString("en-US")),
      isInsecureEndpoint(getConfig().baseUrl) && t.insecure,
    ].filter(Boolean) as string[];
    if (warnings.length)
      showToast({
        style: Toast.Style.Failure,
        title: warnings[0],
        message: warnings.slice(1).join(" · ") || undefined,
      });
  }, [request.text, request.startedAt]);

  const clippedRequest = { ...request, text };
  if (request.mode === "translate") return <ResultDetail {...clippedRequest} />;
  if (request.mode === "summarize") return <SummarizeDetail {...clippedRequest} />;
  return <EditableForm {...clippedRequest} />;
}
