import { getSelectedText, launchCommand, LaunchType } from "@raycast/api";
import type { LLMRequest, Mode } from "./llm-view";

export type TextArgs = { arguments: { text?: string } };

// Runs as a no-view command. Input: text typed as the command argument in Raycast, otherwise the
// current selection (grabbed while the source app is still focused). Then opens the result view,
// so each run starts a fresh request; with no input at all it opens an input form instead.
export async function launchWithSelection(mode: Mode, typed?: string) {
  const startedAt = Date.now();
  const text = typed?.trim() || (await getSelectedText().catch(() => "")).trim();
  // Nothing typed or selected: open the result command with an empty text, which shows an input form.
  const context: LLMRequest = { mode, text, startedAt };
  await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
}
