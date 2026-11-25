import { getPreferenceValues } from "@raycast/api";
import type { Mode } from "./llm-view";
import type { PromptId } from "./prompts";

/**
 * Interface language (Settings → Language). Only the app's own labels and guides change:
 * the AI content (translations, Vietnamese meanings and lessons) stays the same, as it is the
 * point of a Vietnamese ⇄ English tool.
 */
export type Language = "vi" | "en";

const vi = {
  // Buddy Home
  featuresSection: "Chức năng",
  runWith: (text: string) => `Chạy với: "${text}"`,
  hotkeyHint: "Gợi ý hotkey",
  inputHint: "Text bôi đen, hoặc gõ ở ô phía trên",
  settingsSection: "Cài đặt",
  featureSubtitle: {
    translate: "Việt ⇄ Anh",
    reply: "Soạn nháp câu trả lời",
    rewrite: "Sửa tiếng Anh + học",
  } as Record<Mode, string>,
  guide: {
    translate: `## 🌐 Buddy Translate
Dịch nhanh, tự nhận ngôn ngữ: tiếng Việt → tiếng Anh, còn lại → tiếng Việt. Giữ nguyên thuật ngữ kỹ thuật (PR, deploy, ticket…).

### Cách dùng
1. Bôi đen đoạn text ở bất kỳ app nào (Slack, Teams, trình duyệt…)
2. Bấm hotkey, kết quả hiện ngay kèm câu gốc

Hoặc gõ / dán text vào ô phía trên rồi bấm **↵**.

### 🔤 Phát âm (phần tiếng Anh)
- Từ / cụm ngắn: thẻ từ điển gồm loại từ (n, v…), IPA, nghĩa, cách dùng và 3 câu ví dụ
- Câu: **Từ vựng** ở cột phải: loại từ (n, v…), IPA và nghĩa
- Nghe (⌘L) bằng giọng hệ thống macOS

### Trong màn hình kết quả
- **↵** Copy bản dịch · **⌘L** Nghe phần tiếng Anh
- Từ đơn: **⌘1 ⌘2 ⌘3** nghe từng câu ví dụ
- **⌘⇧V** Dán vào app · **⌘O** Mở Cambridge · **⌘R** Dịch lại`,
    reply: `## ↩️ Buddy Draft Reply
Gợi ý câu trả lời cho tin nhắn, đúng ngôn ngữ và xưng hô (anh/em, "Dạ okay"…).

### Cách dùng
1. Bôi đen tin nhắn (hoặc vài tin gần nhất để có ngữ cảnh)
2. Bấm hotkey, câu trả lời gợi ý hiện ra, sửa trực tiếp được
3. Chưa đúng ý? Gõ ý chính vào ô **💡 Idea** (tiếng Việt cũng được) rồi **↵**. Mỗi idea chỉnh tiếp trên bản hiện tại.

### Trong màn hình kết quả
- **↵** Copy câu trả lời (hoặc áp dụng idea nếu đang gõ)
- **⌘⇧V** Dán thẳng vào ô chat
- **⌘R** Viết lại từ đầu`,
    rewrite: `## ✏️ Buddy Polish English
Viết lại draft tiếng Anh cho đúng ngữ pháp, tự nhiên. Kèm **📘 Lessons**: các lỗi đã sửa và quy tắc ngữ pháp để học.

### Cách dùng
1. Gõ draft trong ô chat, bôi đen
2. Bấm hotkey, bản viết lại hiện ra, sửa trực tiếp được
3. Muốn thêm ý / đổi giọng văn? Gõ vào ô **💡 Idea** rồi **↵**
4. **↵** để thay draft đang bôi đen bằng bản mới

### Trong màn hình kết quả
- **↵** Thay draft (hoặc áp dụng idea nếu đang gõ)
- **⌘⇧C** Copy
- **⌘R** Viết lại từ đầu`,
  } as Record<Mode, string>,
  promptsSubtitle: "Tuỳ chỉnh prompt từng buddy",
  promptsGuide: `## ✍️ Prompts
Nhấn **↵** để xem và sửa prompt của từng buddy: vai trò, giọng văn, quy tắc xưng hô, ví dụ…

- **Translate** - dịch câu, đoạn văn
- **Dictionary Lookup** - thẻ từ điển khi tra từ / cụm ≤ 3 từ
- **Draft Reply** - soạn câu trả lời
- **Polish English** - sửa tiếng Anh + bài học
- **Vocabulary** - cột Từ vựng khi dịch câu

Phần định dạng output được code giữ cố định, nên sửa thoải mái không làm hỏng giao diện. Bản mặc định luôn khôi phục được (**⌃X**).

Lưu ở \`prompts.json\` trong Data Folder.`,
  settingsSubtitle: "Ngôn ngữ, API key, model, hotkey",
  settingsGuide: `## ⚙️ Settings
Nhấn **↵** để mở trang cài đặt của AI Buddy trong Raycast:

- **Base URL** - endpoint OpenAI-compatible (cliproxy, Ollama…)
- **API Key** - lưu trong Raycast (Keychain)
- **Model** - đổi model không cần sửa code
- **Language** - ngôn ngữ giao diện: Tiếng Việt / English
- **Hotkey** - gán phím tắt cho từng lệnh ở cột bên phải
- **Giọng đọc** - theo System voice của macOS (Accessibility → Read & Speak)

### Dữ liệu lưu trên máy
- **Từ đã tra** (nghĩa, IPA, cách dùng, ví dụ) - lưu để lần sau hiện ngay ⚡
- **Prompt đã sửa** - \`prompts.json\`
- ⌘K → **Show Data Folder** để xem · **Clear Dictionary Cache** để xoá

Gợi ý hotkey: **⌃⌘T** Translate · **⌃⌘R** Draft Reply · **⌃⌘E** Polish English`,

  // Prompts screen
  promptSubtitle: {
    translate: "Dịch câu, đoạn văn",
    lookup: "Tra từ / cụm ≤ 3 từ",
    reply: "Soạn câu trả lời",
    rewrite: "Sửa tiếng Anh + bài học",
    vocab: "Cột Từ vựng khi dịch câu",
  } as Record<PromptId, string>,
  edited: "Đã sửa",
  instructions: "Hướng dẫn",
  instructionsState: (edited: boolean): string => (edited ? "(đã sửa)" : "(mặc định)"),
  fixedPart: "Phần cố định",
  fixedPartNote: "Code tự thêm vào cuối prompt: định dạng input / output mà app cần để hiển thị kết quả.",
  formNoteTitle: "Lưu ý",
  formNote:
    "Định dạng input/output được code tự thêm vào cuối, không cần viết lại. Để trống rồi lưu = dùng mặc định. ⌘↵ để lưu.",

  // Result views
  ideaPlaceholder: {
    reply: "Input idea (vd: chưa kịp, mai 9h gửi), then ↵",
    rewrite: "Input idea (vd: thêm ý, lịch sự hơn), then ↵",
  },
  applied: "Đã áp dụng",
  direction: "Dịch",
  toEnglish: "Tiếng Việt → English",
  toVietnamese: "English → Tiếng Việt",
  vocabulary: "Từ vựng",
  usage: "Cách dùng",
  phrases: "Cụm hay gặp",
  examples: "Ví dụ",
  listenHint: (keys: string) => `${keys} để nghe từng câu`,
  clipped: (max: string) => `Text quá dài: chỉ gửi ${max} ký tự đầu`,
  insecure: "Base URL dùng http://: API key và nội dung gửi đi không được mã hoá",
  insecureShort: "⚠️ http không mã hoá",
};

type Strings = typeof vi;

const en: Strings = {
  featuresSection: "Buddies",
  runWith: (text) => `Run with: "${text}"`,
  hotkeyHint: "Suggested hotkey",
  inputHint: "Selected text, or type in the search bar",
  settingsSection: "Settings",
  featureSubtitle: { translate: "Vietnamese ⇄ English", reply: "Draft a reply", rewrite: "Fix English + learn" },
  guide: {
    translate: `## 🌐 Buddy Translate
Fast translation with language detection: Vietnamese → English, anything else → Vietnamese. Tech terms (PR, deploy, ticket…) are kept as they are.

### How to use
1. Select text in any app (Slack, Teams, browser…)
2. Press the hotkey: the result shows with the original

Or type / paste text in the search bar above and press **↵**.

### 🔤 Pronunciation (English side)
- Word / short phrase: a dictionary card with part of speech (n, v…), IPA, meaning, usage and 3 examples
- Sentence: **Vocabulary** in the side panel: part of speech, IPA and meaning
- Listen (⌘L) with the macOS system voice

### In the result
- **↵** Copy translation · **⌘L** Listen to the English side
- Word: **⌘1 ⌘2 ⌘3** listen to each example
- **⌘⇧V** Paste in app · **⌘O** Open Cambridge · **⌘R** Translate again`,
    reply: `## ↩️ Buddy Draft Reply
Suggests a reply to a message, in the right language and Vietnamese pronouns (anh/em, "Dạ okay"…).

### How to use
1. Select the message (or the last few, for context)
2. Press the hotkey: the suggested reply shows and can be edited
3. Not quite right? Type the key point in **💡 Idea** (Vietnamese is fine) and press **↵**. Each idea revises the current version.

### In the result
- **↵** Copy the reply (or apply the idea while typing one)
- **⌘⇧V** Paste into the chat box
- **⌘R** Start over`,
    rewrite: `## ✏️ Buddy Polish English
Rewrites an English draft into correct, natural English. Plus **📘 Lessons**: the mistakes fixed and the grammar rules behind them.

### How to use
1. Type the draft in the chat box and select it
2. Press the hotkey: the rewrite shows and can be edited
3. Want to add a point or change the tone? Type it in **💡 Idea** and press **↵**
4. **↵** replaces the selected draft with the new version

### In the result
- **↵** Replace draft (or apply the idea while typing one)
- **⌘⇧C** Copy
- **⌘R** Start over`,
  },
  promptsSubtitle: "Customize each buddy's prompt",
  promptsGuide: `## ✍️ Prompts
Press **↵** to view and edit each buddy's prompt: role, tone, pronoun rules, examples…

- **Translate** - sentences and paragraphs
- **Dictionary Lookup** - the dictionary card for words / phrases of ≤ 3 words
- **Draft Reply** - reply drafts
- **Polish English** - English fixes + lessons
- **Vocabulary** - the Vocabulary panel for sentences

The output format is kept fixed by the code, so edits can't break the screens. The default can always be restored (**⌃X**).

Saved in \`prompts.json\` in the Data Folder.`,
  settingsSubtitle: "Language, API key, model, hotkeys",
  settingsGuide: `## ⚙️ Settings
Press **↵** to open AI Buddy's settings in Raycast:

- **Base URL** - OpenAI-compatible endpoint (cliproxy, Ollama…)
- **API Key** - stored by Raycast (Keychain)
- **Model** - switch models without code changes
- **Language** - interface language: Tiếng Việt / English
- **Hotkey** - assign a hotkey to each command in the right column
- **Voice** - the macOS system voice (Accessibility → Read & Speak)

### Data on this Mac
- **Looked-up words** (meaning, IPA, usage, examples) - kept so they show instantly next time ⚡
- **Edited prompts** - \`prompts.json\`
- ⌘K → **Show Data Folder** to view · **Clear Dictionary Cache** to delete

Suggested hotkeys: **⌃⌘T** Translate · **⌃⌘R** Draft Reply · **⌃⌘E** Polish English`,

  promptSubtitle: {
    translate: "Sentences and paragraphs",
    lookup: "Words / phrases of ≤ 3 words",
    reply: "Reply drafts",
    rewrite: "English fixes + lessons",
    vocab: "Vocabulary panel for sentences",
  },
  edited: "Edited",
  instructions: "Instructions",
  instructionsState: (edited) => (edited ? "(edited)" : "(default)"),
  fixedPart: "Fixed part",
  fixedPartNote: "Added by the code at the end of the prompt: the input / output format the app needs to show results.",
  formNoteTitle: "Note",
  formNote:
    "The input/output format is added by the code, no need to write it. Save empty = use the default. ⌘↵ to save.",

  ideaPlaceholder: {
    reply: "Input idea (e.g. not yet, will send at 9am), then ↵",
    rewrite: "Input idea (e.g. add a point, more polite), then ↵",
  },
  applied: "Applied",
  direction: "Direction",
  toEnglish: "Vietnamese → English",
  toVietnamese: "English → Vietnamese",
  vocabulary: "Vocabulary",
  usage: "Usage",
  phrases: "Common phrases",
  examples: "Examples",
  listenHint: (keys) => `${keys} to listen to each one`,
  clipped: (max) => `Text too long: only the first ${max} characters are sent`,
  insecure: "Base URL uses http://: the API key and your text are sent unencrypted",
  insecureShort: "⚠️ http, not encrypted",
};

/** Strings for the language chosen in Settings (read on each render, so a change applies on reopen). */
export const ui = (): Strings => (getPreferenceValues<{ language?: Language }>().language === "en" ? en : vi);
