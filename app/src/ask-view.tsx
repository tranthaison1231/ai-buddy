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
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { getLanguage, ui } from "./i18n";
import {
  ChatMessage,
  clipInput,
  dataBlock,
  getConfig,
  isInsecureEndpoint,
  MAX_INPUT_CHARS,
  streamMessages,
} from "./llm";
import { stripImages } from "./llm-view";
import { systemPrompt } from "./prompts";

export type AskRequest = {
  mode: "ask";
  question?: string;
  context?: string;
  startedAt: number;
};

type Turn = { question: string; answer: string };
type Run = { id: number; at: number };

const LOADING = "⏳ Loading…";
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const settingsAction = (
  <Action
    title="Open Settings"
    icon={Icon.Gear}
    shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
    onAction={openExtensionPreferences}
  />
);

function extractCodeBlock(markdown: string): string | undefined {
  const blocks = [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  return blocks.length ? blocks[blocks.length - 1] : undefined;
}

function formatConversation(turns: Turn[], activeQuestion: string, activeAnswer: string): string {
  const all = [...turns, ...(activeAnswer ? [{ question: activeQuestion, answer: activeAnswer }] : [])];
  return all.map((turn) => `### You\n${turn.question}\n\n### AI Buddy\n${turn.answer}`).join("\n\n---\n\n");
}

function quoteLines(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function buildFirstUserMessage(question: string, context?: string): string {
  return context ? `${dataBlock("context", context)}\n\n${question}` : question;
}

function FollowUpForm({ onSubmit }: { onSubmit: (question: string) => void }) {
  const { pop } = useNavigation();
  const t = ui();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string>();

  return (
    <Form
      navigationTitle={t.askFollowUpTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Ask Follow-Up"
            icon="buddy-ask.png"
            onSubmit={() => {
              const trimmed = question.trim();
              if (!trimmed) {
                setError(t.askEmptyError);
                return;
              }
              pop();
              onSubmit(trimmed);
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="followup"
        title="💬 Follow-up"
        value={question}
        placeholder={t.askFollowUpPlaceholder}
        error={error}
        onChange={(value) => {
          setQuestion(value);
          if (error) setError(undefined);
        }}
        autoFocus
      />
      <Form.Description text={t.askSubmitHint} />
    </Form>
  );
}

/** Form shown when Buddy Ask is opened without an inline question (with optional selected-text context). */
export function AskForm({ initialContext = "" }: { initialContext?: string }) {
  const { push } = useNavigation();
  const t = ui();
  const isEn = getLanguage() === "en";
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState(initialContext);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setContext(initialContext);
  }, [initialContext]);

  const askWith = (q: string) => {
    const trimmedQuestion = q.trim();
    if (!trimmedQuestion) {
      setError(t.askEmptyError);
      return;
    }
    push(<AskView initialQuestion={trimmedQuestion} context={context.trim() || undefined} startedAt={Date.now()} />);
  };

  const hasContext = context.trim().length > 0;

  return (
    <Form
      navigationTitle="Buddy Ask"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Ask" icon="buddy-ask.png" onSubmit={() => askWith(question)} />
          {hasContext && (
            <Action
              title="Explain Context"
              icon={Icon.LightBulb}
              shortcut={{ modifiers: ["cmd"], key: "1" }}
              onAction={() =>
                askWith(
                  isEn
                    ? "Explain this clearly and concisely. If it's an error or code, explain the root cause and how to fix it."
                    : "Giải thích rõ ràng, dễ hiểu nội dung này bằng tiếng Việt. Nếu là lỗi hoặc code, chỉ rõ nguyên nhân và cách xử lý.",
                )
              }
            />
          )}
          {hasContext && (
            <Action
              title="Find Bugs or Issues"
              icon={Icon.Bug}
              shortcut={{ modifiers: ["cmd"], key: "2" }}
              onAction={() =>
                askWith(
                  isEn
                    ? "Review this for bugs, edge cases, or logical issues and suggest concrete fixes."
                    : "Kiểm tra giúp các lỗi, edge case hoặc vấn đề logic trong đoạn này và gợi ý cách sửa cụ thể.",
                )
              }
            />
          )}
          {hasContext && (
            <Action
              title="Extract Key Takeaways"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "3" }}
              onAction={() =>
                askWith(
                  isEn
                    ? "List the key takeaways and any action items from this context."
                    : "Rút ra các ý chính quan trọng nhất và việc cần làm (nếu có) từ nội dung này.",
                )
              }
            />
          )}
          {settingsAction}
        </ActionPanel>
      }
    >
      <Form.TextField
        id="question"
        title={t.askQuestionField}
        value={question}
        placeholder={hasContext ? t.askWithContextPlaceholder : t.askPlaceholder}
        error={error}
        onChange={(value) => {
          setQuestion(value);
          if (error) setError(undefined);
        }}
        autoFocus
      />
      <Form.TextArea
        id="context"
        title={t.askContextField}
        value={context}
        placeholder={t.askContextPlaceholder}
        onChange={setContext}
      />
      <Form.Description text={hasContext ? t.askQuickPresetHint : t.askSubmitHint} />
    </Form>
  );
}

/** Multi-turn Q&A view for Buddy Ask with streaming Markdown and follow-up support. */
export function AskView({
  initialQuestion,
  context,
  startedAt,
}: {
  initialQuestion: string;
  context?: string;
  startedAt: number;
}) {
  const t = ui();
  const { providerName, model, baseUrl } = getConfig();
  const { text: clippedContext, clipped } = useMemo(
    () => (context ? clipInput(context) : { text: "", clipped: false }),
    [context],
  );
  const system = useMemo(() => systemPrompt("ask"), []);

  const [history, setHistory] = useState<Turn[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  const [totalMs, setTotalMs] = useState<number>();
  const [run, setRun] = useState<Run>({ id: 0, at: startedAt });

  // Reset conversation when launched with a fresh request.
  useEffect(() => {
    setHistory([]);
    setActiveQuestion(initialQuestion);
    setAnswer("");
    setError(undefined);
    setTotalMs(undefined);
    setRun((r) => (r.id === 0 && r.at === startedAt ? r : { id: 0, at: startedAt }));
  }, [initialQuestion, context, startedAt]);

  // Warn once per launch if context was truncated or endpoint is plain HTTP.
  useEffect(() => {
    const warnings = [
      clipped && t.clipped(MAX_INPUT_CHARS.toLocaleString("en-US")),
      isInsecureEndpoint(baseUrl) && t.insecure,
    ].filter(Boolean) as string[];
    if (warnings.length) {
      showToast({
        style: Toast.Style.Failure,
        title: warnings[0],
        message: warnings.slice(1).join(" · ") || undefined,
      });
    }
  }, [clipped, baseUrl, startedAt]);

  useEffect(() => {
    const controller = new AbortController();
    setAnswer("");
    setError(undefined);
    setTotalMs(undefined);

    const messages: ChatMessage[] = [{ role: "system", content: system }];
    history.forEach((turn, idx) => {
      messages.push({
        role: "user",
        content: idx === 0 ? buildFirstUserMessage(turn.question, clippedContext || undefined) : turn.question,
      });
      messages.push({ role: "assistant", content: turn.answer });
    });
    messages.push({
      role: "user",
      content:
        history.length === 0 ? buildFirstUserMessage(activeQuestion, clippedContext || undefined) : activeQuestion,
    });

    (async () => {
      try {
        for await (const chunk of streamMessages(model, messages, controller.signal)) {
          setAnswer((prev) => prev + chunk);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!controller.signal.aborted) setTotalMs(Date.now() - run.at);
      }
    })();

    return () => controller.abort();
  }, [run]);

  const [now, setNow] = useState(Date.now());
  const isLoading = totalMs === undefined;
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isLoading]);

  const handleFollowUp = (nextQuestion: string) => {
    if (answer.trim()) {
      setHistory((prev) => [...prev, { question: activeQuestion, answer: answer.trim() }]);
    }
    setActiveQuestion(nextQuestion);
    setRun((r) => ({ id: r.id + 1, at: Date.now() }));
  };

  const regenerate = () => setRun((r) => ({ id: r.id + 1, at: Date.now() }));

  const safeAnswer = stripImages(answer.trim());
  const pending = `${LOADING} ${seconds(Math.max(0, now - run.at))}`;
  const latestBlock = error
    ? `${quoteLines(`**You:** ${activeQuestion}`)}\n\n## ⚠️ Error\n\n\`\`\`\n${error}\n\`\`\``
    : `${quoteLines(`**You:** ${activeQuestion}`)}\n\n${safeAnswer || (isLoading ? `_${pending}_` : "_(empty response)_")}`;

  // Show newest turn at the top so streaming output is always immediately visible in Raycast Detail.
  const previousBlocks = [...history]
    .reverse()
    .map((turn) => `${quoteLines(`**You:** ${turn.question}`)}\n\n${stripImages(turn.answer)}`);

  const contextPreview =
    clippedContext &&
    `**${t.askContextAttached}**\n\n${quoteLines(
      clippedContext.length > 500 ? `${clippedContext.slice(0, 500)}…` : clippedContext,
    )}`;

  const markdown = [latestBlock, ...previousBlocks, contextPreview].filter(Boolean).join("\n\n---\n\n");
  const codeBlock = extractCodeBlock(answer);
  const totalTurns = history.length + 1;
  const fullConversation = formatConversation(history, activeQuestion, answer.trim());

  const metadata = (
    <Detail.Metadata>
      <Detail.Metadata.Label title={t.askTurns} text={String(totalTurns)} />
      {clippedContext && (
        <Detail.Metadata.Label
          title={t.askContextLabel}
          text={`${clippedContext.length.toLocaleString("en-US")} chars`}
        />
      )}
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label title="Provider" text={providerName} />
      <Detail.Metadata.Label title="Model" text={model || "—"} />
    </Detail.Metadata>
  );

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={isLoading ? LOADING : `⏱ ${seconds(totalMs)}`}
      markdown={markdown}
      metadata={metadata}
      actions={
        <ActionPanel>
          {error && settingsAction}
          {answer.trim() && <Action.CopyToClipboard title="Copy Answer" content={answer.trim()} />}
          <Action.Push title="Ask Follow-Up" icon={Icon.Message} target={<FollowUpForm onSubmit={handleFollowUp} />} />
          {answer.trim() && (
            <Action.Paste
              title="Paste Answer in Active App"
              content={answer.trim()}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          )}
          {codeBlock && (
            <Action.CopyToClipboard
              title="Copy Code Block"
              icon={Icon.Code}
              content={codeBlock}
              shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
            />
          )}
          {history.length > 0 && fullConversation && (
            <Action.CopyToClipboard
              title="Copy Full Conversation"
              icon={Icon.Clipboard}
              content={fullConversation}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          )}
          <Action
            title="Regenerate"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={regenerate}
          />
          <Action.Push
            title="New Question"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={<AskForm />}
          />
          {!error && settingsAction}
        </ActionPanel>
      }
    />
  );
}
