import {
  Action,
  ActionPanel,
  Color,
  environment,
  Icon,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useState } from "react";
import { getConfig, isInsecureEndpoint } from "./llm";
import { LLMView, Mode } from "./llm-view";
import { clearLookupCache } from "./lookup";
import { clearPronunciationCache } from "./pronounce";
import { PromptList } from "./prompts-view";
import { ui } from "./i18n";

const FEATURES: { mode: Mode; title: string; icon: string; hotkey: string }[] = [
  { mode: "translate", title: "Buddy Translate", icon: "buddy-translate.png", hotkey: "⌃⌘T" },
  { mode: "reply", title: "Buddy Draft Reply", icon: "buddy-draft-reply.png", hotkey: "⌃⌘R" },
  { mode: "rewrite", title: "Buddy Polish English", icon: "buddy-polish.png", hotkey: "⌃⌘E" },
];

export function BuddyHome() {
  const { baseUrl, model } = getConfig();
  const t = ui();
  const [text, setText] = useState("");
  const typed = text.trim();
  const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const settingsAction = (
    <Action
      title="Open Settings (Language, API Key, Model, Hotkeys)"
      icon={Icon.Gear}
      shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
      onAction={openExtensionPreferences}
    />
  );

  return (
    <List
      isShowingDetail
      filtering={false}
      onSearchTextChange={setText}
      searchBarPlaceholder="Input text, then pick a buddy and press ↵"
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
                    <List.Item.Detail.Metadata.Label title="Input" text={t.inputHint} />
                    <List.Item.Detail.Metadata.Label title="Model" text={model} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                {typed ? (
                  <Action.Push
                    title={`Run ${f.title}`}
                    icon={Icon.Play}
                    target={<LLMView mode={f.mode} text={typed} startedAt={Date.now()} />}
                  />
                ) : null}
                {settingsAction}
              </ActionPanel>
            }
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
          detail={
            <List.Item.Detail
              markdown={t.settingsGuide}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Model" text={model} />
                  <List.Item.Detail.Metadata.Label title="Endpoint" text={host} />
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
