import {
  Clipboard,
  getSelectedText,
  launchCommand,
  LaunchProps,
  LaunchType,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { cleanOutput, dataBlock, getConfig, MAX_INPUT_CHARS, streamChat, WriteLanguage, WriteStyle } from "./llm";
import { formatWriteTarget, systemPrompt } from "./prompts";
import type { WriteRequest } from "./write-view";

type WriteArgs = { arguments: { notes?: string; style?: string } };

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function parseStyle(value?: string): WriteStyle {
  return value === "email" || value === "concise" || value === "formal" ? value : "chat";
}

async function openWriteView(context: WriteRequest) {
  await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
}

async function writeAndReplace(selected: string, style: WriteStyle, language: WriteLanguage) {
  const startedAt = Date.now();
  const match = selected.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const lead = match?.[1] ?? "";
  const core = match?.[2] ?? "";
  const trail = match?.[3] ?? "";

  if (core.length > MAX_INPUT_CHARS) {
    // Avoid silently truncating and overwriting an oversized selection.
    await openWriteView({ mode: "write", notes: core, style, language, fromSelection: true, startedAt });
    return;
  }

  const toast = await showToast({ style: Toast.Style.Animated, title: "Writing…" });
  const controller = new AbortController();

  try {
    const { model } = getConfig();
    const system = systemPrompt("write", formatWriteTarget(style, language));
    const user = dataBlock("text", core);

    let full = "";
    for await (const chunk of streamChat(model, system, user, controller.signal)) {
      full += chunk;
    }

    const written = cleanOutput(full, core);
    if (!written) {
      toast.style = Toast.Style.Failure;
      toast.title = "Empty response from model";
      return;
    }

    await Clipboard.paste(`${lead}${written}${trail}`);
    await toast.hide();
    await showHUD(`✓ Written (${seconds(Date.now() - startedAt)})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    toast.style = Toast.Style.Failure;
    toast.title = "Write failed";
    toast.message = message.split("\n")[0];
    toast.primaryAction = {
      title: "Open Settings",
      onAction: () => openExtensionPreferences(),
    };
  }
}

export default async function Command(props: LaunchProps<WriteArgs>) {
  const startedAt = Date.now();
  const typed = props.arguments.notes?.trim() ?? "";
  const style = parseStyle(props.arguments.style);
  const { writeMode, writeLanguage } = getConfig();

  if (typed) {
    await openWriteView({
      mode: "write",
      notes: typed,
      style,
      language: writeLanguage,
      fromSelection: false,
      startedAt,
    });
    return;
  }

  const selected = await getSelectedText().catch(() => "");
  if (selected.trim()) {
    if (writeMode === "replace") {
      await writeAndReplace(selected, style, writeLanguage);
      return;
    }
    await openWriteView({
      mode: "write",
      notes: selected.trim(),
      style,
      language: writeLanguage,
      fromSelection: true,
      startedAt,
    });
    return;
  }

  await openWriteView({
    mode: "write",
    style,
    language: writeLanguage,
    fromSelection: false,
    startedAt,
  });
}
