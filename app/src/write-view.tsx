import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Keyboard,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { ui } from "./i18n";
import {
  cleanOutput,
  clipInput,
  dataBlock,
  getConfig,
  isInsecureEndpoint,
  MAX_INPUT_CHARS,
  streamChat,
  WriteLanguage,
  WriteStyle,
} from "./llm";
import { isVietnamese } from "./llm-view";
import { formatWriteTarget, systemPrompt } from "./prompts";

export type WriteRequest = {
  mode: "write";
  notes?: string;
  style?: WriteStyle;
  language?: WriteLanguage;
  fromSelection?: boolean;
  startedAt: number;
};

const LOADING = "⏳ Loading…";
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const STYLE_TITLE: Record<WriteStyle, string> = {
  chat: "💬 Chat",
  email: "📧 Email",
  concise: "⚡ Short",
  formal: "🎩 Formal",
};

const settingsAction = (
  <Action
    title="Open Settings"
    icon={Icon.Gear}
    shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
    onAction={openExtensionPreferences}
  />
);

export function WriteForm({
  initialNotes = "",
  initialStyle = "chat",
  initialLanguage,
}: {
  initialNotes?: string;
  initialStyle?: WriteStyle;
  initialLanguage?: WriteLanguage;
}) {
  const { push } = useNavigation();
  const t = ui();
  const cfg = getConfig();
  const [notes, setNotes] = useState(initialNotes);
  const [style, setStyle] = useState<WriteStyle>(initialStyle);
  const [language, setLanguage] = useState<WriteLanguage>(initialLanguage ?? cfg.writeLanguage);
  const [error, setError] = useState<string>();

  const submit = () => {
    const trimmed = notes.trim();
    if (!trimmed) {
      setError(t.writeEmptyError);
      return;
    }
    push(
      <WriteView
        initialNotes={trimmed}
        initialStyle={style}
        initialLanguage={language}
        fromSelection={false}
        startedAt={Date.now()}
      />,
    );
  };

  return (
    <Form
      navigationTitle="Buddy Write"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Write Message" icon="buddy-write.png" onSubmit={submit} />
          {settingsAction}
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="notes"
        title={t.writeNotesField}
        placeholder={t.writeNotesPlaceholder}
        value={notes}
        error={error}
        onChange={(v) => {
          setNotes(v);
          if (error) setError(undefined);
        }}
        autoFocus
      />
      <Form.Dropdown id="style" title={t.writeStyleField} value={style} onChange={(v) => setStyle(v as WriteStyle)}>
        <Form.Dropdown.Item value="chat" title={t.writeStyleLabel.chat} />
        <Form.Dropdown.Item value="email" title={t.writeStyleLabel.email} />
        <Form.Dropdown.Item value="concise" title={t.writeStyleLabel.concise} />
        <Form.Dropdown.Item value="formal" title={t.writeStyleLabel.formal} />
      </Form.Dropdown>
      <Form.Dropdown
        id="language"
        title={t.writeLanguageField}
        value={language}
        onChange={(v) => setLanguage(v as WriteLanguage)}
      >
        <Form.Dropdown.Item value="auto" title={t.writeLanguageLabel.auto} />
        <Form.Dropdown.Item value="en" title={t.writeLanguageLabel.en} />
        <Form.Dropdown.Item value="vi" title={t.writeLanguageLabel.vi} />
      </Form.Dropdown>
      <Form.Description text={t.writeFormHint} />
    </Form>
  );
}

type Run = {
  id: number;
  at: number;
  style: WriteStyle;
  language: WriteLanguage;
  idea: string;
  previous: string;
};

export function WriteView({
  initialNotes,
  initialStyle = "chat",
  initialLanguage,
  fromSelection = false,
  startedAt,
}: {
  initialNotes: string;
  initialStyle?: WriteStyle;
  initialLanguage?: WriteLanguage;
  fromSelection?: boolean;
  startedAt: number;
}) {
  const { push } = useNavigation();
  const t = ui();
  const cfg = getConfig();
  const resolvedLang = initialLanguage ?? cfg.writeLanguage;
  const { text: notes, clipped } = useMemo(() => clipInput(initialNotes), [initialNotes]);

  const [run, setRun] = useState<Run>({
    id: 0,
    at: startedAt,
    style: initialStyle,
    language: resolvedLang,
    idea: "",
    previous: "",
  });
  const [output, setOutput] = useState("");
  const [answer, setAnswer] = useState("");
  const [idea, setIdea] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [totalMs, setTotalMs] = useState<number>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setRun((r) =>
      r.id === 0 && r.at === startedAt && r.style === initialStyle && r.language === resolvedLang
        ? r
        : { id: 0, at: startedAt, style: initialStyle, language: resolvedLang, idea: "", previous: "" },
    );
    setIdea("");
    setApplied([]);
  }, [initialNotes, initialStyle, resolvedLang, startedAt]);

  useEffect(() => {
    const warnings = [
      clipped && t.clipped(MAX_INPUT_CHARS.toLocaleString("en-US")),
      isInsecureEndpoint(cfg.baseUrl) && t.insecure,
    ].filter(Boolean) as string[];
    if (warnings.length) {
      showToast({
        style: Toast.Style.Failure,
        title: warnings[0],
        message: warnings.slice(1).join(" · ") || undefined,
      });
    }
  }, [initialNotes, startedAt]);

  const system = useMemo(
    () => systemPrompt("write", formatWriteTarget(run.style, run.language)),
    [run.style, run.language],
  );

  useEffect(() => {
    const controller = new AbortController();
    setOutput("");
    setError(undefined);
    setTotalMs(undefined);

    const user =
      dataBlock("text", notes) +
      (run.previous ? `\n${dataBlock("previous", run.previous)}` : "") +
      (run.idea ? `\n${dataBlock("idea", run.idea)}` : "");

    (async () => {
      try {
        for await (const chunk of streamChat(cfg.model, system, user, controller.signal)) {
          setOutput((prev) => prev + chunk);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!controller.signal.aborted) setTotalMs(Date.now() - run.at);
      }
    })();

    return () => controller.abort();
  }, [notes, system, run]);

  const isLoading = totalMs === undefined;
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isLoading]);

  const cleaned = cleanOutput(output, notes);
  useEffect(() => setAnswer(cleaned), [cleaned]);

  const hasIdea = idea.trim() !== "";
  const revise = () => {
    const next = idea.trim();
    if (!next) return;
    setApplied((list) => [...list, next]);
    setIdea("");
    setRun((r) => ({ ...r, id: r.id + 1, at: Date.now(), idea: next, previous: answer }));
  };

  const switchStyle = (nextStyle: WriteStyle) => {
    setApplied([]);
    setIdea("");
    setRun((r) => ({ ...r, id: r.id + 1, at: Date.now(), style: nextStyle, idea: "", previous: "" }));
  };

  const isCurrentVietnamese = run.language === "vi" || (run.language === "auto" && isVietnamese(answer || notes));
  const nextLanguage: Exclude<WriteLanguage, "auto"> = isCurrentVietnamese ? "en" : "vi";

  const toggleLanguage = () => {
    setApplied([]);
    setIdea("");
    setRun((r) => ({ ...r, id: r.id + 1, at: Date.now(), language: nextLanguage, idea: "", previous: "" }));
  };

  const startOver = () => {
    setApplied([]);
    setIdea("");
    setRun((r) => ({ ...r, id: r.id + 1, at: Date.now(), idea: "", previous: "" }));
  };

  const pending = `${LOADING} ${seconds(Math.max(0, now - run.at))}`;
  const langTag = run.language === "en" ? "EN" : run.language === "vi" ? "VI" : "Auto";
  const draftTitle = `${STYLE_TITLE[run.style]} · ${langTag}`;
  const navigationTitle = isLoading ? LOADING : `⏱ ${seconds(totalMs)} · ${STYLE_TITLE[run.style]}`;

  const copy = (
    <Action.CopyToClipboard
      title="Copy Draft"
      icon={Icon.Clipboard}
      content={answer}
      shortcut={Keyboard.Shortcut.Common.Copy}
    />
  );
  const paste = (
    <Action.Paste
      title={fromSelection ? "Replace Selection" : "Paste in Active App"}
      content={answer}
      shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
    />
  );
  const [primary, secondary] = fromSelection ? [paste, copy] : [copy, paste];

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          {hasIdea && <Action title="Apply Tweak" icon={Icon.Wand} onAction={revise} />}
          {answer && primary}
          {answer && secondary}
          {error && settingsAction}
          <Action
            title={nextLanguage === "en" ? "Write in English" : "Write in Tiếng Việt"}
            icon={Icon.Globe}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={toggleLanguage}
          />
          <ActionPanel.Section title="Switch Style">
            <Action
              title="Chat / Slack"
              icon={Icon.Message}
              shortcut={{ modifiers: ["cmd"], key: "1" }}
              onAction={() => switchStyle("chat")}
            />
            <Action
              title="Email"
              icon={Icon.Envelope}
              shortcut={{ modifiers: ["cmd"], key: "2" }}
              onAction={() => switchStyle("email")}
            />
            <Action
              title="Short & Direct"
              icon={Icon.Bolt}
              shortcut={{ modifiers: ["cmd"], key: "3" }}
              onAction={() => switchStyle("concise")}
            />
            <Action
              title="Formal"
              icon={Icon.Document}
              shortcut={{ modifiers: ["cmd"], key: "4" }}
              onAction={() => switchStyle("formal")}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Regenerate"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={startOver}
            />
            <Action
              title="New Notes"
              icon={Icon.Plus}
              shortcut={Keyboard.Shortcut.Common.New}
              onAction={() => push(<WriteForm initialStyle={run.style} initialLanguage={run.language} />)}
            />
            {!error && settingsAction}
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <Form.Description title={t.writeNotesField} text={notes} />
      {error ? (
        <Form.Description title="⚠️ Error" text={error} />
      ) : (
        <Form.TextArea
          id="answer"
          title={draftTitle}
          value={answer}
          onChange={setAnswer}
          placeholder={isLoading ? pending : "(empty response)"}
        />
      )}
      <Form.TextField
        id="idea"
        title={t.writeRefineField}
        value={idea}
        onChange={setIdea}
        placeholder={t.ideaPlaceholder.write}
      />
      {applied.length > 0 && <Form.Description title="" text={`${t.applied}: ${applied.join(" → ")}`} />}
      <Form.Description title="" text={t.writeShortcutHint} />
    </Form>
  );
}
