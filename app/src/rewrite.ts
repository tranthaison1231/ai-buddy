import {
  Clipboard,
  getSelectedText,
  LaunchProps,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { launchWithSelection, TextArgs } from "./launch";
import { cleanOutput, dataBlock, getConfig, MAX_INPUT_CHARS, splitLessons, streamChat } from "./llm";
import { LESSONS_MARKER, systemPrompt } from "./prompts";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function polishAndReplace(selected: string) {
  const startedAt = Date.now();
  const match = selected.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const lead = match?.[1] ?? "";
  const core = match?.[2] ?? "";
  const trail = match?.[3] ?? "";

  if (core.length > MAX_INPUT_CHARS) {
    // Avoid silently truncating and overwriting an oversized selection.
    await launchWithSelection("rewrite", core);
    return;
  }

  const toast = await showToast({ style: Toast.Style.Animated, title: "Polishing…" });
  const controller = new AbortController();
  let stoppedEarly = false;

  try {
    const { model } = getConfig();
    const system = systemPrompt("rewrite");
    const user = dataBlock("text", core);

    let full = "";
    try {
      for await (const chunk of streamChat(model, system, user, controller.signal)) {
        full += chunk;
        // Lessons aren't needed for instant replace: stop streaming once the marker arrives.
        if (full.includes(LESSONS_MARKER)) {
          stoppedEarly = true;
          controller.abort();
          break;
        }
      }
    } catch (e) {
      if (!stoppedEarly) throw e;
    }

    const polished = splitLessons(cleanOutput(full, core)).main;
    if (!polished) {
      toast.style = Toast.Style.Failure;
      toast.title = "Empty response from model";
      return;
    }

    await Clipboard.paste(`${lead}${polished}${trail}`);
    await toast.hide();
    await showHUD(`✓ Polished (${seconds(Date.now() - startedAt)})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    toast.style = Toast.Style.Failure;
    toast.title = "Polish failed";
    toast.message = message.split("\n")[0];
    toast.primaryAction = {
      title: "Open Settings",
      onAction: () => openExtensionPreferences(),
    };
  }
}

export default async function Command(props: LaunchProps<TextArgs>) {
  const typed = props.arguments.text?.trim();
  const { polishMode } = getConfig();

  if (polishMode === "replace" && !typed) {
    const selected = await getSelectedText().catch(() => "");
    if (selected.trim()) {
      await polishAndReplace(selected);
      return;
    }
  }

  await launchWithSelection("rewrite", typed);
}
