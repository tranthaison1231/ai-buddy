import { launchCommand, LaunchProps, LaunchType, showHUD } from "@raycast/api";
import { captureScreenRegion, readClipboardImage, VisionSource } from "./vision-io";
import type { VisionRequest } from "./vision-view";

type VisionArgs = {
  arguments: {
    prompt?: string;
    source?: VisionSource;
  };
};

export default async function Command(props: LaunchProps<VisionArgs>) {
  const prompt = props.arguments.prompt?.trim() || undefined;
  const source: VisionSource = props.arguments.source || "screen";

  if (source === "file") {
    const context: VisionRequest = {
      mode: "vision",
      pickFile: true,
      prompt,
      startedAt: Date.now(),
    };
    await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
    return;
  }

  if (source === "clipboard") {
    const imagePath = await readClipboardImage();
    if (!imagePath) {
      await showHUD("No image in clipboard — pick an image file or capture screen");
      const context: VisionRequest = {
        mode: "vision",
        pickFile: true,
        prompt,
        startedAt: Date.now(),
      };
      await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
      return;
    }
    const context: VisionRequest = {
      mode: "vision",
      imagePath,
      source: "clipboard",
      prompt,
      startedAt: Date.now(),
    };
    await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
    return;
  }

  // Default: interactive screen region capture.
  let imagePath: string | undefined;
  try {
    imagePath = await captureScreenRegion();
  } catch (e) {
    await showHUD(e instanceof Error ? e.message : String(e));
    return;
  }

  if (!imagePath) return; // User cancelled capture with Esc.

  const context: VisionRequest = {
    mode: "vision",
    imagePath,
    source: "screen",
    prompt,
    startedAt: Date.now(),
  };
  await launchCommand({ name: "result", type: LaunchType.UserInitiated, context });
}
