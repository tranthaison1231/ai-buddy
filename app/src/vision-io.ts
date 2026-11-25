import { Clipboard, closeMainWindow, environment } from "@raycast/api";
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type VisionSource = "screen" | "clipboard" | "file";

export type PreparedImage = {
  previewPath: string;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
};

const MAX_EDGE_PX = 1600;
const MAX_DIRECT_BYTES = 1_500_000;
const KEEP_TEMP_FILES = 8;

const SUPPORTED_WEB_FORMATS: Record<string, { ext: string; mime: string }> = {
  png: { ext: ".png", mime: "image/png" },
  jpeg: { ext: ".jpg", mime: "image/jpeg" },
  jpg: { ext: ".jpg", mime: "image/jpeg" },
  webp: { ext: ".webp", mime: "image/webp" },
  gif: { ext: ".gif", mime: "image/gif" },
};

const visionDir = () => {
  const dir = join(environment.supportPath, "vision-tmp");
  mkdirSync(dir, { recursive: true });
  return dir;
};

function pruneTempFiles() {
  try {
    const dir = visionDir();
    const files = readdirSync(dir)
      .map((name) => {
        const path = join(dir, name);
        try {
          return { path, mtime: statSync(path).mtimeMs };
        } catch {
          return undefined;
        }
      })
      .filter((f): f is { path: string; mtime: number } => Boolean(f))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files.slice(KEEP_TEMP_FILES)) {
      try {
        unlinkSync(file.path);
      } catch {
        // Ignore cleanup errors on already-removed files.
      }
    }
  } catch {
    // Best-effort cleanup.
  }
}

const tempFile = (prefix: string, ext: string) =>
  join(visionDir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);

type ImageMeta = { width: number; height: number; format: string };

async function inspectImage(filePath: string): Promise<ImageMeta | undefined> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/sips", [
      "-g",
      "pixelWidth",
      "-g",
      "pixelHeight",
      "-g",
      "format",
      filePath,
    ]);
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
    const format = (stdout.match(/format:\s*(\S+)/)?.[1] ?? "").toLowerCase();
    if (!width || !height || !format) return undefined;
    return { width, height, format };
  } catch {
    return undefined;
  }
}

/**
 * Hides Raycast and launches macOS interactive region/window capture (`screencapture -i -x`).
 * Returns the captured PNG path, or `undefined` if the user pressed Esc to cancel.
 */
export async function captureScreenRegion(): Promise<string | undefined> {
  pruneTempFiles();
  const outPath = tempFile("capture", ".png");

  await closeMainWindow();
  // Give macOS a brief beat to finish hiding Raycast before showing the capture crosshair.
  await new Promise((resolve) => setTimeout(resolve, 150));

  try {
    await execFileAsync("/usr/sbin/screencapture", ["-i", "-x", "-t", "png", outPath]);
  } catch (e) {
    const stderr =
      typeof e === "object" && e !== null && "stderr" in e
        ? String((e as { stderr?: unknown }).stderr ?? "").trim()
        : "";
    if (!existsSync(outPath)) {
      if (stderr && /permission|record|denied|cannot/i.test(stderr)) {
        throw new Error(
          "Screen Recording permission is required. Enable Raycast in System Settings → Privacy & Security → Screen & System Audio Recording.",
        );
      }
      return undefined;
    }
  }

  if (!existsSync(outPath) || statSync(outPath).size === 0) return undefined;
  return outPath;
}

const CLIPBOARD_IMAGE_SCRIPT = `
on run argv
  set outPath to item 1 of argv
  try
    set rawData to the clipboard as «class PNGf»
    set f to open for access (POSIX file outPath) with write permission
    try
      set eof f to 0
      write rawData to f
    end try
    close access f
    return "png"
  on error
    try
      set rawData to the clipboard as TIFF picture
      set f to open for access (POSIX file outPath) with write permission
      try
        set eof f to 0
        write rawData to f
      end try
      close access f
      return "tiff"
    on error
      return ""
    end try
  end try
end run
`;

/**
 * Reads an image from the macOS clipboard (either copied image data or a copied image file).
 * Returns a local path inside `vision-tmp/`, or `undefined` if the clipboard holds no image.
 */
export async function readClipboardImage(): Promise<string | undefined> {
  pruneTempFiles();

  // 1. Check Raycast's Clipboard.read(), which returns a file path for copied images & Finder files.
  try {
    const clip = await Clipboard.read();
    if (clip.file) {
      const sourcePath = clip.file.startsWith("file://") ? fileURLToPath(clip.file) : clip.file;
      if (existsSync(sourcePath)) {
        const meta = await inspectImage(sourcePath);
        if (meta) {
          const ext = extname(sourcePath) || `.${meta.format}`;
          const dest = tempFile("clip", ext);
          copyFileSync(sourcePath, dest);
          return dest;
        }
      }
    }
  } catch {
    // Fall through to AppleScript pasteboard check.
  }

  // 2. Fallback: extract raw PNG or TIFF bytes directly from the macOS pasteboard.
  const rawPath = tempFile("clip-raw", ".bin");
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", CLIPBOARD_IMAGE_SCRIPT, rawPath]);
    const kind = stdout.trim();
    if (!kind || !existsSync(rawPath) || statSync(rawPath).size === 0) {
      if (existsSync(rawPath)) unlinkSync(rawPath);
      return undefined;
    }
    const finalPath = tempFile("clip", ".png");
    if (kind === "png") {
      copyFileSync(rawPath, finalPath);
    } else {
      await execFileAsync("/usr/bin/sips", ["-s", "format", "png", rawPath, "--out", finalPath]);
    }
    unlinkSync(rawPath);
    return existsSync(finalPath) ? finalPath : undefined;
  } catch {
    if (existsSync(rawPath)) {
      try {
        unlinkSync(rawPath);
      } catch {
        // Ignore cleanup failure.
      }
    }
    return undefined;
  }
}

/**
 * Validates and optimizes an image for multimodal LLM APIs and Raycast Markdown preview:
 * - Converts non-web formats (HEIC, TIFF, BMP…) to JPEG/PNG.
 * - Downscales only if larger than 1600px on the longest edge (never upscales small text screenshots).
 * - Keeps crisp PNGs as-is when already compact (≤ 1600px and ≤ 1.5 MB).
 */
export async function prepareVisionImage(filePath: string): Promise<PreparedImage> {
  const normalizedPath = filePath.startsWith("file://") ? fileURLToPath(filePath) : filePath;
  if (!existsSync(normalizedPath)) {
    throw new Error(`Image file not found: ${normalizedPath}`);
  }

  const meta = await inspectImage(normalizedPath);
  if (!meta) {
    throw new Error("The selected file is not a supported image (PNG, JPG, WebP, GIF, HEIC, TIFF).");
  }

  const originalBytes = statSync(normalizedPath).size;
  const webFormat = SUPPORTED_WEB_FORMATS[meta.format];
  const needsResize = Math.max(meta.width, meta.height) > MAX_EDGE_PX;
  const needsCompression = originalBytes > MAX_DIRECT_BYTES;

  let finalPath = normalizedPath;
  let mimeType = webFormat?.mime ?? "image/jpeg";
  let width = meta.width;
  let height = meta.height;

  if (!webFormat || needsResize || needsCompression) {
    const usePng = !needsResize && !needsCompression && meta.format === "tiff";
    finalPath = tempFile("vision", usePng ? ".png" : ".jpg");
    const args = usePng
      ? ["-s", "format", "png", normalizedPath, "--out", finalPath]
      : [
          ...(needsResize ? ["-Z", String(MAX_EDGE_PX)] : []),
          "-s",
          "format",
          "jpeg",
          "-s",
          "formatOptions",
          "85",
          normalizedPath,
          "--out",
          finalPath,
        ];
    await execFileAsync("/usr/bin/sips", args);
    mimeType = usePng ? "image/png" : "image/jpeg";
    const updated = await inspectImage(finalPath);
    if (updated) {
      width = updated.width;
      height = updated.height;
    }
  }

  const buffer = readFileSync(finalPath);
  return {
    previewPath: finalPath,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    width,
    height,
    bytes: buffer.length,
    mimeType,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
