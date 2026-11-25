import { getSelectedText, launchCommand, LaunchProps, LaunchType } from "@raycast/api";
import type { AskRequest } from "./ask-view";

type AskArgs = { arguments: { question?: string } };

export default async function Command(props: LaunchProps<AskArgs>) {
  const startedAt = Date.now();
  const question = props.arguments.question?.trim() || "";
  // Only attach selected text when no inline question was typed, so unrelated background selection is never leaked.
  const context = question ? "" : (await getSelectedText().catch(() => "")).trim();
  const launchContext: AskRequest = {
    mode: "ask",
    question: question || undefined,
    context: context || undefined,
    startedAt,
  };
  await launchCommand({ name: "result", type: LaunchType.UserInitiated, context: launchContext });
}
