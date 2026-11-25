import {
  Action,
  ActionPanel,
  Color,
  environment,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { AskForm, AskView } from "./ask-view";
import { ui } from "./i18n";
import { getConfig, getConfigError, isInsecureEndpoint } from "./llm";
import { LLMView, Mode } from "./llm-view";
import { clearLookupCache } from "./lookup";
import { PromptList } from "./prompts-view";
import { clearPronunciationCache } from "./pronounce";
import { captureScreenRegion, readClipboardImage } from "./vision-io";
import { VisionFileForm, VisionRequest, VisionView } from "./vision-view";
import { WriteForm, WriteView } from "./write-view";

export type HomeFeatureId = Mode | "write" | "ask" | "vision";

const FEATURES: { mode: HomeFeatureId; title: string; icon: string; hotkey: string }[] = [
  { mode: "translate", title: "Buddy Translate", icon: "buddy-translate.png", hotkey: "⌃⌘T" },
  { mode: "reply", title: "Buddy Draft Reply", icon: "buddy-draft-reply.png", hotkey: "⌃⌘R" },
  { mode: "rewrite", title: "Buddy Polish English", icon: "buddy-polish.png", hotkey: "⌃⌘E" },
  { mode: "write", title: "Buddy Write", icon: "buddy-write.png", hotkey: "⌃⌘W" },
  { mode: "summarize", title: "Buddy Summarize", icon: "buddy-summarize.png", hotkey: "⌃⌘S" },
  { mode: "ask", title: "Buddy Ask", icon: "buddy-ask.png", hotkey: "⌃⌘A" },
  { mode: "vision", title: "Buddy Vision", icon: "buddy-vision.png", hotkey: "⌃⌘V" },
];

export function BuddyHome() {
  const { push } = useNavigation();
  const cfg = getConfig();
  const { providerName, baseUrl, model } = cfg;
  const configError = getConfigError(cfg);
  const t = ui();
  const [text, setText] = useState("");
  const typed = text.trim();
  const host = baseUrl ? baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "—";

  const settingsAction = (
    <Action
      title="Open Settings (Provider, API Key, Model, Hotkeys)"
      icon={Icon.Gear}
      shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
      onAction={openExtensionPreferences}
    />
  );

  const captureVision = async () => {
    try {
      const imagePath = await captureScreenRegion();
      if (!imagePath) return;
      const context: VisionRequest = {
        mode: "vision",
        imagePath,
        source: "screen",
        prompt: typed || undefined,
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

  const clipboardVision = async () => {
    const imagePath = await readClipboardImage();
    if (!imagePath) {
      await showToast({ style: Toast.Style.Failure, title: t.visionNoClipboard });
      return;
    }
    push(
      <VisionView imagePath={imagePath} source="clipboard" initialPrompt={typed || undefined} startedAt={Date.now()} />,
    );
  };

  const renderActions = (f: (typeof FEATURES)[number]) => {
    if (f.mode === "write") {
      return (
        <ActionPanel>
          <Action.Push
            title={typed ? `Run ${f.title}` : "Open Buddy Write"}
            icon={Icon.Play}
            target={typed ? <WriteView initialNotes={typed} startedAt={Date.now()} /> : <WriteForm />}
          />
          {typed && (
            <Action.Push
              title="Write as Email"
              icon={Icon.Envelope}
              target={<WriteView initialNotes={typed} initialStyle="email" startedAt={Date.now()} />}
            />
          )}
          {settingsAction}
        </ActionPanel>
      );
    }

    if (f.mode === "ask") {
      return (
        <ActionPanel>
          <Action.Push
            title={typed ? `Run ${f.title}` : "Open Buddy Ask"}
            icon={Icon.Play}
            target={typed ? <AskView initialQuestion={typed} startedAt={Date.now()} /> : <AskForm />}
          />
          {typed && (
            <Action.Push title="Use Input as Context" icon={Icon.Text} target={<AskForm initialContext={typed} />} />
          )}
          {settingsAction}
        </ActionPanel>
      );
    }

    if (f.mode === "vision") {
      return (
        <ActionPanel>
          <Action title="Capture Screen Region" icon={Icon.Camera} onAction={captureVision} />
          <Action title="Analyze Clipboard Image" icon={Icon.Clipboard} onAction={clipboardVision} />
          <Action.Push
            title="Choose Image File"
            icon={Icon.Finder}
            shortcut={Keyboard.Shortcut.Common.Open}
            target={<VisionFileForm initialPrompt={typed} />}
          />
          {settingsAction}
        </ActionPanel>
      );
    }

    const mode = f.mode;
    return (
      <ActionPanel>
        {typed ? (
          <Action.Push
            title={`Run ${f.title}`}
            icon={Icon.Play}
            target={<LLMView mode={mode} text={typed} startedAt={Date.now()} />}
          />
        ) : null}
        {settingsAction}
      </ActionPanel>
    );
  };

  return (
    <List
      isShowingDetail
      filtering={false}
      onSearchTextChange={setText}
      searchBarPlaceholder="Input text or question, then pick a buddy and press ↵"
      navigationTitle="AI Buddy"
    >
      <List.Section
        title={typed ? t.runWith(`${typed.slice(0, 40)}${typed.length > 40 ? "…" : ""}`) : t.featuresSection}
      >
        {FEATURES.map((f) => (
          <List.Item
            key={f.mode}
            title={f.title}
            subtitle={t.featureSubtitle[f.mode]}
            icon={f.icon}
            detail={
              <List.Item.Detail
                markdown={t.guide[f.mode]}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.TagList title={t.hotkeyHint}>
                      <List.Item.Detail.Metadata.TagList.Item text={f.hotkey} color={Color.Blue} />
                    </List.Item.Detail.Metadata.TagList>
                    <List.Item.Detail.Metadata.Label
                      title="Input"
                      text={f.mode === "vision" ? t.visionInputHint : t.inputHint}
                    />
                    <List.Item.Detail.Metadata.Label title="Provider" text={providerName} />
                    <List.Item.Detail.Metadata.Label title="Model" text={model || "—"} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={renderActions(f)}
          />
        ))}
      </List.Section>
      <List.Section title={t.settingsSection}>
        <List.Item
          title="Prompts"
          subtitle={t.promptsSubtitle}
          icon={{ source: Icon.Text, tintColor: Color.SecondaryText }}
          detail={<List.Item.Detail markdown={t.promptsGuide} />}
          actions={
            <ActionPanel>
              <Action.Push title="Edit Prompts" icon={Icon.Pencil} target={<PromptList />} />
              {settingsAction}
            </ActionPanel>
          }
        />
        <List.Item
          title="Settings"
          subtitle={t.settingsSubtitle}
          icon={{ source: Icon.Gear, tintColor: Color.SecondaryText }}
          accessories={[
            configError
              ? { tag: { value: t.notConfigured, color: Color.Orange } }
              : { tag: { value: providerName, color: Color.Green } },
          ]}
          detail={
            <List.Item.Detail
              markdown={t.settingsGuide}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Active Provider" text={providerName} />
                  <List.Item.Detail.Metadata.Label title="Model" text={model || "—"} />
                  <List.Item.Detail.Metadata.Label title="Endpoint" text={host} />
                  {configError && (
                    <List.Item.Detail.Metadata.TagList title="">
                      <List.Item.Detail.Metadata.TagList.Item text={t.notConfigured} color={Color.Orange} />
                    </List.Item.Detail.Metadata.TagList>
                  )}
                  {isInsecureEndpoint(baseUrl) && (
                    <List.Item.Detail.Metadata.TagList title="">
                      <List.Item.Detail.Metadata.TagList.Item text={t.insecureShort} color={Color.Red} />
                    </List.Item.Detail.Metadata.TagList>
                  )}
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              {settingsAction}
              <Action.ShowInFinder title="Show Data Folder" path={environment.supportPath} />
              <Action
                title="Clear Dictionary Cache"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={async () => {
                  clearPronunciationCache();
                  clearLookupCache();
                  await showToast({ style: Toast.Style.Success, title: "Dictionary cache cleared" });
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
