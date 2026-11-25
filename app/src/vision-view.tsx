import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { pathToFileURL } from "node:url";
import { getLanguage, ui } from "./i18n";
import { ChatMessage, getConfig, isInsecureEndpoint, streamMessages, VisionAction } from "./llm";
import { stripImages } from "./llm-view";
import { systemPrompt, Target } from "./prompts";
import {
  captureScreenRegion,
  formatFileSize,
  PreparedImage,
  prepareVisionImage,
  readClipboardImage,
  VisionSource,
} from "./vision-io";

export type VisionRequest = {
  mode: "vision";
  imagePath?: string;
  source?: VisionSource;
  prompt?: string;
  action?: VisionAction;
  pickFile?: boolean;
  startedAt: number;
};

type Turn = { promptLabel: string; userPrompt: string; answer: string };
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

function buildVisionInstruction(action: VisionAction, target: Target, customPrompt?: string): string {
  if (action === "ask" && customPrompt?.trim()) return customPrompt.trim();
  if (action === "ocr") {
    return "Extract and transcribe ALL visible text from this image accurately, preserving line breaks, structure, code blocks, and Markdown tables if applicable. Output only the extracted text with no preamble or commentary.";
  }
  if (action === "translate") {
    return "Read all visible text in this image and translate it naturally: if the text is primarily Vietnamese, translate it to English; otherwise translate it to Vietnamese. Preserve structure, numbers, and common technical terms. Output only the translation.";
  }
  if (action === "summarize") {
    return `Summarize the content of this image in ${target} using clean Markdown:
### TL;DR
1-2 sentences capturing the main point.

### Key Points
- 2-5 concise bullets with the most important details.

### Action Items
- Include ONLY if concrete tasks, requests, or deadlines appear in the image; omit otherwise.`;
  }
  return `Explain clearly and concisely what is shown in this image in ${target}. If it shows code, a terminal log, or an error message, explain the root cause and suggest a concrete fix. If it shows a slide, chart, or UI, highlight the key points.`;
}

function actionLabel(action: VisionAction): string {
  const t = ui();
  return t.visionActionLabel[action];
}

function sourceLabel(source: VisionSource): string {
  const t = ui();
  return t.visionSourceLabel[source];
}

function quoteLines(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function VisionQuestionForm({ onSubmit }: { onSubmit: (question: string) => void }) {
  const { pop } = useNavigation();
  const t = ui();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string>();

  return (
    <Form
      navigationTitle={t.visionAskTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Ask About Image"
            icon="buddy-vision.png"
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
        id="question"
        title={t.askQuestionField}
        value={question}
        placeholder={t.visionAskPlaceholder}
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

/** Form to choose an image file, capture a screen region, or analyze a clipboard image. */
export function VisionFileForm({ initialPrompt = "" }: { initialPrompt?: string }) {
  const { push } = useNavigation();
  const t = ui();
  const cfg = getConfig();
  const [files, setFiles] = useState<string[]>([]);
  const [action, setAction] = useState<VisionAction>(initialPrompt ? "ask" : cfg.visionAction);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [fileError, setFileError] = useState<string>();

  const captureAndOpen = async () => {
    try {
      const captured = await captureScreenRegion();
      if (!captured) return;
      const context: VisionRequest = {
        mode: "vision",
        imagePath: captured,
        source: "screen",
        action: prompt.trim() ? "ask" : action,
        prompt: prompt.trim() || undefined,
        startedAt: Date.now(),
      };
      await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Screen capture failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const clipboardAndOpen = async () => {
    const clipPath = await readClipboardImage();
    if (!clipPath) {
      await showToast({ style: Toast.Style.Failure, title: t.visionNoClipboard });
      return;
    }
    push(
      <VisionView
        imagePath={clipPath}
        source="clipboard"
        initialAction={prompt.trim() ? "ask" : action}
        initialPrompt={prompt.trim() || undefined}
        startedAt={Date.now()}
      />,
    );
  };

  return (
    <Form
      navigationTitle="Buddy Vision"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Analyze Image"
            icon="buddy-vision.png"
            onSubmit={() => {
              const selected = files[0];
              if (!selected) {
                setFileError(t.visionPickFileError);
                return;
              }
              const customPrompt = prompt.trim() || undefined;
              push(
                <VisionView
                  imagePath={selected}
                  source="file"
                  initialAction={customPrompt ? "ask" : action}
                  initialPrompt={customPrompt}
                  startedAt={Date.now()}
                />,
              );
            }}
          />
          <Action
            title="Capture Screen Region"
            icon={Icon.Camera}
            shortcut={Keyboard.Shortcut.Common.New}
            onAction={captureAndOpen}
          />
          <Action
            title="Use Clipboard Image"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "b" }}
            onAction={clipboardAndOpen}
          />
          {settingsAction}
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="files"
        title={t.visionImageField}
        allowMultipleSelection={false}
        canChooseFiles
        canChooseDirectories={false}
        value={files}
        error={fileError}
        onChange={(next) => {
          setFiles(next);
          if (fileError) setFileError(undefined);
        }}
      />
      <Form.Dropdown
        id="action"
        title={t.visionActionField}
        value={action}
        onChange={(value) => setAction(value as VisionAction)}
      >
        <Form.Dropdown.Item value="explain" title={t.visionActionLabel.explain} />
        <Form.Dropdown.Item value="ocr" title={t.visionActionLabel.ocr} />
        <Form.Dropdown.Item value="translate" title={t.visionActionLabel.translate} />
        <Form.Dropdown.Item value="summarize" title={t.visionActionLabel.summarize} />
        <Form.Dropdown.Item value="ask" title={t.visionActionLabel.ask} />
      </Form.Dropdown>
      <Form.TextField
        id="prompt"
        title={t.visionCustomQuestionField}
        value={prompt}
        placeholder={t.visionAskPlaceholder}
        onChange={(value) => {
          setPrompt(value);
          if (value.trim() && action !== "ask") setAction("ask");
        }}
      />
      <Form.Description text={t.visionFormHint} />
    </Form>
  );
}

/** Multimodal analysis view for Buddy Vision with 1-key mode switching and follow-up questions. */
export function VisionView({
  imagePath,
  source = "screen",
  initialPrompt,
  initialAction,
  startedAt,
}: {
  imagePath: string;
  source?: VisionSource;
  initialPrompt?: string;
  initialAction?: VisionAction;
  startedAt: number;
}) {
  const t = ui();
  const cfg = getConfig();
  const { providerName, model, baseUrl } = cfg;
  const target: Target = getLanguage() === "en" ? "English" : "Vietnamese";
  const system = useMemo(() => systemPrompt("vision"), []);

  const resolvedInitialAction: VisionAction = initialPrompt ? "ask" : (initialAction ?? cfg.visionAction);

  const [currentPath, setCurrentPath] = useState(imagePath);
  const [currentSource, setCurrentSource] = useState<VisionSource>(source);
  const [preparedState, setPreparedState] = useState<{ path: string; image: PreparedImage }>();
  const [prepError, setPrepError] = useState<string>();
  const [showPreview, setShowPreview] = useState(true);
  const prepared = preparedState?.path === currentPath ? preparedState.image : undefined;

  const [action, setAction] = useState<VisionAction>(resolvedInitialAction);
  const [activePrompt, setActivePrompt] = useState(
    buildVisionInstruction(resolvedInitialAction, target, initialPrompt),
  );
  const [activeLabel, setActiveLabel] = useState(initialPrompt || actionLabel(resolvedInitialAction));
  const [history, setHistory] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  const [totalMs, setTotalMs] = useState<number>();
  const [run, setRun] = useState<Run>({ id: 0, at: startedAt });

  // Reset state when launched with a fresh capture/image request.
  useEffect(() => {
    const nextAction: VisionAction = initialPrompt ? "ask" : (initialAction ?? getConfig().visionAction);
    setCurrentPath(imagePath);
    setCurrentSource(source);
    setAction(nextAction);
    setActivePrompt(buildVisionInstruction(nextAction, target, initialPrompt));
    setActiveLabel(initialPrompt || actionLabel(nextAction));
    setHistory([]);
    setAnswer("");
    setError(undefined);
    setTotalMs(undefined);
    setRun((r) => (r.id === 0 && r.at === startedAt ? r : { id: 0, at: startedAt }));
  }, [imagePath, source, initialPrompt, initialAction, startedAt]);

  // Warn once if endpoint is plain HTTP.
  useEffect(() => {
    if (isInsecureEndpoint(baseUrl)) {
      showToast({ style: Toast.Style.Failure, title: t.insecure });
    }
  }, [baseUrl, startedAt]);

  // Prepare/optimize the image whenever currentPath changes.
  useEffect(() => {
    let cancelled = false;
    setPreparedState(undefined);
    setPrepError(undefined);
    prepareVisionImage(currentPath)
      .then((image) => {
        if (!cancelled) setPreparedState({ path: currentPath, image });
      })
      .catch((e) => {
        if (!cancelled) {
          setPrepError(e instanceof Error ? e.message : String(e));
          setTotalMs(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  // Stream LLM response once the image is ready.
  useEffect(() => {
    if (!prepared) return;
    const controller = new AbortController();
    setAnswer("");
    setError(undefined);
    setTotalMs(undefined);

    const messages: ChatMessage[] = [{ role: "system", content: system }];
    if (history.length === 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: activePrompt },
          { type: "image_url", image_url: { url: prepared.dataUrl } },
        ],
      });
    } else {
      history.forEach((turn, idx) => {
        messages.push({
          role: "user",
          content:
            idx === 0
              ? [
                  { type: "text", text: turn.userPrompt },
                  { type: "image_url", image_url: { url: prepared.dataUrl } },
                ]
              : turn.userPrompt,
        });
        messages.push({ role: "assistant", content: turn.answer });
      });
      messages.push({ role: "user", content: activePrompt });
    }

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
  }, [prepared, run]);

  const [now, setNow] = useState(Date.now());
  const isLoading = !prepError && (prepared === undefined || totalMs === undefined);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isLoading]);

  const switchMode = (next: Exclude<VisionAction, "ask">) => {
    setAction(next);
    setHistory([]);
    setActivePrompt(buildVisionInstruction(next, target));
    setActiveLabel(actionLabel(next));
    setRun((r) => ({ id: r.id + 1, at: Date.now() }));
  };

  const askFollowUp = (question: string) => {
    if (answer.trim()) {
      setHistory((prev) => [...prev, { promptLabel: activeLabel, userPrompt: activePrompt, answer: answer.trim() }]);
    }
    setAction("ask");
    setActivePrompt(question);
    setActiveLabel(question);
    setRun((r) => ({ id: r.id + 1, at: Date.now() }));
  };

  const regenerate = () => setRun((r) => ({ id: r.id + 1, at: Date.now() }));

  const captureNew = async () => {
    try {
      const captured = await captureScreenRegion();
      if (!captured) return;
      const context: VisionRequest = {
        mode: "vision",
        imagePath: captured,
        source: "screen",
        action: action === "ask" ? cfg.visionAction : action,
        startedAt: Date.now(),
      };
      await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Screen capture failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const useClipboard = async () => {
    const clipPath = await readClipboardImage();
    if (!clipPath) {
      await showToast({ style: Toast.Style.Failure, title: t.visionNoClipboard });
      return;
    }
    const nextAction = action === "ask" ? cfg.visionAction : action;
    setPreparedState(undefined);
    setCurrentPath(clipPath);
    setCurrentSource("clipboard");
    setHistory([]);
    setAction(nextAction);
    setActivePrompt(buildVisionInstruction(nextAction, target));
    setActiveLabel(actionLabel(nextAction));
    setRun((r) => ({ id: r.id + 1, at: Date.now() }));
  };

  const displayError = prepError || error;
  const safeAnswer = stripImages(answer.trim());
  const pending = `${LOADING} ${seconds(Math.max(0, now - run.at))}`;
  const previewBlock =
    showPreview && prepared ? `![Captured](${pathToFileURL(prepared.previewPath).href}?raycast-height=180)` : "";

  const activeHeader = action === "ask" ? `${quoteLines(`**You:** ${activeLabel}`)}\n\n` : "";
  const latestBlock = displayError
    ? `${activeHeader}## ⚠️ Error\n\n\`\`\`\n${displayError}\n\`\`\``
    : `${activeHeader}${safeAnswer || (isLoading ? `_${pending}_` : "_(empty response)_")}`;

  const previousBlocks = [...history]
    .reverse()
    .map((turn) => `${quoteLines(`**${turn.promptLabel}**`)}\n\n${stripImages(turn.answer)}`);

  const markdown = [previewBlock, latestBlock, ...previousBlocks].filter(Boolean).join("\n\n---\n\n");

  const metadata = (
    <Detail.Metadata>
      <Detail.Metadata.Label title={t.visionActionField} text={actionLabel(action)} />
      <Detail.Metadata.Label title={t.visionSourceField} text={sourceLabel(currentSource)} />
      {prepared && (
        <Detail.Metadata.Label
          title={t.visionImageField}
          text={`${prepared.width} × ${prepared.height} · ${formatFileSize(prepared.bytes)}`}
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
      navigationTitle={isLoading ? LOADING : `⏱ ${seconds(totalMs ?? 0)}`}
      markdown={markdown}
      metadata={metadata}
      actions={
        <ActionPanel>
          {displayError && settingsAction}
          {answer.trim() && <Action.CopyToClipboard title="Copy Result" content={answer.trim()} />}
          <Action.Push
            title="Ask About Image"
            icon={Icon.Message}
            target={<VisionQuestionForm onSubmit={askFollowUp} />}
          />
          {answer.trim() && (
            <Action.Paste
              title="Paste in Active App"
              content={answer.trim()}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          )}
          <ActionPanel.Section title={t.visionSwitchSection}>
            <Action
              title={t.visionActionLabel.ocr}
              icon={Icon.Text}
              shortcut={{ modifiers: ["cmd"], key: "1" }}
              onAction={() => switchMode("ocr")}
            />
            <Action
              title={t.visionActionLabel.translate}
              icon={Icon.Globe}
              shortcut={{ modifiers: ["cmd"], key: "2" }}
              onAction={() => switchMode("translate")}
            />
            <Action
              title={t.visionActionLabel.explain}
              icon={Icon.LightBulb}
              shortcut={{ modifiers: ["cmd"], key: "3" }}
              onAction={() => switchMode("explain")}
            />
            <Action
              title={t.visionActionLabel.summarize}
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "4" }}
              onAction={() => switchMode("summarize")}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title={t.visionSourceSection}>
            <Action
              title={showPreview ? "Hide Image Preview" : "Show Image Preview"}
              icon={showPreview ? Icon.EyeDisabled : Icon.Eye}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={() => setShowPreview((v) => !v)}
            />
            <Action
              title="Regenerate"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={regenerate}
            />
            <Action
              title="Capture New Region"
              icon={Icon.Camera}
              shortcut={Keyboard.Shortcut.Common.New}
              onAction={captureNew}
            />
            <Action
              title="Use Clipboard Image"
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
              onAction={useClipboard}
            />
            <Action.Push
              title="Choose Image File"
              icon={Icon.Finder}
              shortcut={Keyboard.Shortcut.Common.Open}
              target={<VisionFileForm />}
            />
            {prepared && <Action.ShowInFinder title="Show Image in Finder" path={prepared.previewPath} />}
          </ActionPanel.Section>
          {!displayError && settingsAction}
        </ActionPanel>
      }
    />
  );
}
