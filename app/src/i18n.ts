import { getPreferenceValues } from "@raycast/api";
import type { HomeFeatureId } from "./home";
import type { VisionAction, WriteLanguage, WriteStyle } from "./llm";
import type { PromptId } from "./prompts";
import type { VisionSource } from "./vision-io";

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
  visionInputHint: "Chụp vùng màn hình, ảnh clipboard, hoặc chọn file ảnh",
  settingsSection: "Cài đặt",
  featureSubtitle: {
    translate: "Việt ⇄ Anh",
    reply: "Soạn nháp câu trả lời",
    rewrite: "Sửa tiếng Anh + học",
    write: "Ý nháp → Tin nhắn / Email",
    summarize: "Tóm tắt + Action Items",
    ask: "Hỏi AI nhanh + nối tiếp",
    vision: "Đọc, dịch & giải thích ảnh",
  } as Record<HomeFeatureId, string>,
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
- **⌘R** Viết lại từ đầu

*(Mẹo: Vào **Settings → Polish English Mode** chọn **Replace Immediately** nếu muốn bấm hotkey là thay thế ngay không cần mở popup.)*`,
    write: `## 📝 Buddy Write
Biến vài chữ nháp cụt / gạch đầu dòng (tiếng Việt không dấu hoặc tiếng Anh) thành **tin nhắn Slack hoặc email hoàn chỉnh**, giữ đúng ý gốc.

### Cách dùng
1. Gõ nháp ngay trong Slack / Gmail (vd: \`mai nghỉ sáng có việc gd, task A đẩy PR rồi, gấp gọi đt\`), bôi đen rồi bấm hotkey
2. Mặc định (**Replace Immediately**): thay thế thẳng đoạn nháp tại chỗ mà không mở popup
3. Hoặc chọn **Show Popup** trong Settings (hay mở khi chưa bôi đen) để xem trước, đổi phong cách và chỉnh tiếp

### Trong màn hình xem trước
- **↵** Thay thế đoạn chọn (hoặc Copy) · **⌘T** Đổi ngôn ngữ (Tiếng Việt ⇄ English)
- **⌘1** Chat / Slack · **⌘2** Email · **⌘3** Ngắn gọn · **⌘4** Trang trọng
- Gõ vào ô **💡 Chỉnh thêm** rồi **↵** để sửa tiếp trên bản hiện tại

*(Mẹo: Có thể ghi gợi ý đầu câu như \`email:\` hoặc \`en:\` ngay trong đoạn nháp để chỉ định nhanh định dạng / ngôn ngữ.)*`,
    summarize: `## 📋 Buddy Summarize
Tóm tắt nhanh thread Slack/Teams, email, tài liệu hoặc ticket dài thành **TL;DR**, **Key Points** và **Action Items** (nếu có).

### Cách dùng
1. Bôi đen đoạn hội thoại / email / tài liệu ở bất kỳ app nào
2. Bấm hotkey, bản tóm tắt hiện ra ngay theo ngôn ngữ giao diện

Hoặc dán nội dung vào ô tìm kiếm phía trên rồi bấm **↵**.

### Trong màn hình kết quả
- **↵** Copy bản tóm tắt · **⌘⇧V** Dán vào app
- **⌘T** Đổi ngôn ngữ tóm tắt (Tiếng Việt ⇄ English) · **⌘R** Tóm tắt lại`,
    ask: `## 💬 Buddy Ask
Hỏi nhanh AI bất cứ gì ngay trong Raycast — hỗ trợ hỏi nối tiếp (follow-up) và tự đính kèm đoạn text đang bôi đen làm ngữ cảnh.

### Cách dùng
1. **Hỏi nhanh:** Mở Raycast → gõ \`Buddy Ask\` → gõ câu hỏi → **↵**
2. **Hỏi về đoạn đang bôi đen:** Bôi đen code / lỗi / email → bấm hotkey → gõ câu hỏi (hoặc bấm nhanh **⌘1** Giải thích · **⌘2** Tìm lỗi · **⌘3** Ý chính)

### Trong màn hình kết quả
- **↵** Copy câu trả lời · **⌘↵** Hỏi nối tiếp (follow-up)
- **⌘⇧V** Dán vào app · **⌘⇧K** Copy code block (nếu có)
- **⌘R** Trả lời lại · **⌘N** Câu hỏi mới`,
    vision: `## 👁️ Buddy Vision
Chụp nhanh 1 vùng màn hình (hoặc đọc ảnh từ Clipboard / File) để **trích xuất text (OCR), dịch, giải thích lỗi/biểu đồ, hoặc tóm tắt**.

### Cách dùng
1. Bấm hotkey → kéo chọn vùng màn hình cần đọc (hoặc nhấn **Space** để chọn cả cửa sổ, **Esc** để huỷ)
2. Ảnh và kết quả phân tích hiện ngay lập tức
3. Hoặc chọn **Analyze Clipboard Image** (**⌘↵**) / **Choose Image File** (**⌘O**)

### Trong màn hình kết quả
- **↵** Copy kết quả · **⌘↵** Hỏi thêm về bức ảnh này
- **⌘1** OCR · **⌘2** Dịch · **⌘3** Giải thích · **⌘4** Tóm tắt
- **⌘T** Ẩn/hiện ảnh xem trước · **⌘N** Chụp vùng mới · **⌘B** Dùng ảnh Clipboard

*(Lưu ý: Cần model hỗ trợ ảnh như **Google Gemini** hoặc **OpenAI**; lần đầu macOS sẽ hỏi quyền **Screen Recording** cho Raycast.)*`,
  } as Record<HomeFeatureId, string>,
  promptsSubtitle: "Tuỳ chỉnh prompt từng buddy",
  promptsGuide: `## ✍️ Prompts
Nhấn **↵** để xem và sửa prompt của từng buddy: vai trò, giọng văn, quy tắc xưng hô, ví dụ…

- **Translate** - dịch câu, đoạn văn
- **Dictionary Lookup** - thẻ từ điển khi tra từ / cụm ≤ 3 từ
- **Draft Reply** - soạn câu trả lời
- **Polish English** - sửa tiếng Anh + bài học
- **Write** - biến ý nháp thành tin nhắn / email hoàn chỉnh
- **Summarize** - tóm tắt + Action Items
- **Ask** - hỏi đáp nhanh + follow-up
- **Vision** - đọc, dịch, giải thích ảnh
- **Vocabulary** - cột Từ vựng khi dịch câu

Phần định dạng output được code giữ cố định, nên sửa thoải mái không làm hỏng giao diện. Bản mặc định luôn khôi phục được (**⌃X**).

Lưu ở \`prompts.json\` trong Data Folder.`,
  settingsSubtitle: "Provider, API key, model, ngôn ngữ, hotkey",
  settingsGuide: `## ⚙️ Settings
Nhấn **↵** để mở trang cài đặt của AI Buddy trong Raycast:

- **Active Provider** - chọn nhanh **Google Gemini**, **Groq**, **OpenAI**, hoặc **Custom** (Cerebras, OpenRouter, Ollama…)
- **API Key & Model** - cấu hình riêng cho từng provider ngay bên dưới, API key được Raycast lưu bảo mật trong Keychain
- **Language** - ngôn ngữ giao diện: Tiếng Việt / English
- **Polish English Mode** - chọn mở popup xem trước (Show Popup) hoặc thay thế ngay (Replace Immediately)
- **Buddy Write Mode & Language** - chọn thay thế ngay hay mở popup, và ngôn ngữ đầu ra mặc định (Tự động / English / Tiếng Việt)
- **Vision Default Action** - chế độ mặc định khi chụp ảnh với Buddy Vision (Explain / OCR / Translate / Summarize)
- **Hotkey** - gán phím tắt cho từng lệnh ở mục Commands
- **Giọng đọc** - theo System voice của macOS (Accessibility → Read & Speak)

### Dữ liệu lưu trên máy
- **Từ đã tra** (nghĩa, IPA, cách dùng, ví dụ) - lưu để lần sau hiện ngay ⚡
- **Prompt đã sửa** - \`prompts.json\`
- ⌘K → **Show Data Folder** để xem · **Clear Dictionary Cache** để xoá

Gợi ý hotkey: **⌃⌘T** Translate · **⌃⌘R** Draft Reply · **⌃⌘E** Polish English · **⌃⌘W** Write · **⌃⌘S** Summarize · **⌃⌘A** Ask · **⌃⌘V** Vision`,

  // Prompts screen
  promptSubtitle: {
    translate: "Dịch câu, đoạn văn",
    lookup: "Tra từ / cụm ≤ 3 từ",
    reply: "Soạn câu trả lời",
    rewrite: "Sửa tiếng Anh + bài học",
    write: "Ý nháp → Tin nhắn / Email hoàn chỉnh",
    summarize: "Tóm tắt + Action Items",
    ask: "Hỏi AI nhanh + follow-up",
    vision: "Phân tích ảnh chụp màn hình / file",
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
    write: "Gõ yêu cầu chỉnh (vd: lịch sự hơn, ngắn lại 2 câu, thêm cảm ơn…), rồi ↵",
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
  notConfigured: "⚠️ Chưa cấu hình",
  summaryLanguage: "Ngôn ngữ",
  originalLength: "Độ dài gốc",
  formatLength: (words: number, chars: number) =>
    `${words.toLocaleString("en-US")} từ · ${chars.toLocaleString("en-US")} ký tự`,

  // Buddy Write
  writeNotesField: "📝 Ý nháp",
  writeNotesPlaceholder: "Vd: mai nghỉ sáng có việc gd, task A đẩy PR rồi, gấp gọi đt…",
  writeStyleField: "🎨 Phong cách",
  writeLanguageField: "🌐 Ngôn ngữ đầu ra",
  writeRefineField: "💡 Chỉnh thêm",
  writeEmptyError: "Vui lòng nhập ý nháp",
  writeFormHint: "Nhấn ⌘↵ để viết · có thể gõ tiếng Việt không dấu hoặc gạch đầu dòng.",
  writeShortcutHint: "⌘1 Chat · ⌘2 Email · ⌘3 Ngắn gọn · ⌘4 Trang trọng · ⌘T Đổi Anh ⇄ Việt",
  writeStyleLabel: {
    chat: "💬 Chat / Slack",
    email: "📧 Email (kèm Subject)",
    concise: "⚡ Ngắn gọn, đi thẳng vào ý",
    formal: "🎩 Trang trọng / Lịch sự",
  } as Record<WriteStyle, string>,
  writeLanguageLabel: {
    auto: "Tự động (theo ngôn ngữ ý nháp)",
    en: "English",
    vi: "Tiếng Việt",
  } as Record<WriteLanguage, string>,

  // Buddy Ask
  askQuestionField: "❓ Câu hỏi",
  askContextField: "📎 Ngữ cảnh (tuỳ chọn)",
  askPlaceholder: "Hỏi bất cứ gì (vd: lệnh git undo commit trước, giải thích OAuth2…)",
  askWithContextPlaceholder: "Hỏi về đoạn ngữ cảnh bên dưới… (hoặc bấm ⌘1 / ⌘2 / ⌘3)",
  askContextPlaceholder: "Dán thêm code, lỗi, email… để AI hiểu ngữ cảnh (để trống nếu không cần)",
  askSubmitHint: "Nhấn ↵ (hoặc ⌘↵) để gửi câu hỏi.",
  askQuickPresetHint: "↵ Gửi câu hỏi · ⌘1 Giải thích · ⌘2 Tìm lỗi · ⌘3 Rút ý chính",
  askEmptyError: "Vui lòng nhập câu hỏi",
  askFollowUpTitle: "Hỏi nối tiếp",
  askFollowUpPlaceholder: "Gõ câu hỏi tiếp theo dựa trên cuộc hội thoại hiện tại…",
  askTurns: "Lượt hỏi",
  askContextLabel: "Ngữ cảnh",
  askContextAttached: "📎 Ngữ cảnh đính kèm",

  // Buddy Vision
  visionActionField: "Chế độ",
  visionSourceField: "Nguồn",
  visionImageField: "Ảnh",
  visionCustomQuestionField: "💬 Câu hỏi riêng (tuỳ chọn)",
  visionAskTitle: "Hỏi về bức ảnh",
  visionAskPlaceholder: "Vd: chuyển bảng này sang Markdown, lỗi này do đâu…",
  visionPickFileError: "Vui lòng chọn một file ảnh",
  visionNoClipboard: "Không có ảnh trong Clipboard",
  visionFormHint: "Chọn file ảnh rồi nhấn ⌘↵ · hoặc ⌘N chụp vùng màn hình · ⌘B dùng ảnh Clipboard.",
  visionSwitchSection: "Đổi chế độ trên ảnh này",
  visionSourceSection: "Ảnh & nguồn khác",
  visionActionLabel: {
    explain: "🔍 Giải thích",
    ocr: "📝 Trích xuất text (OCR)",
    translate: "🌐 Dịch ảnh",
    summarize: "📋 Tóm tắt ảnh",
    ask: "💬 Hỏi về ảnh",
  } as Record<VisionAction, string>,
  visionSourceLabel: {
    screen: "Chụp màn hình",
    clipboard: "Clipboard",
    file: "File ảnh",
  } as Record<VisionSource, string>,
};

type Strings = typeof vi;

const en: Strings = {
  featuresSection: "Buddies",
  runWith: (text) => `Run with: "${text}"`,
  hotkeyHint: "Suggested hotkey",
  inputHint: "Selected text, or type in the search bar",
  visionInputHint: "Screen capture, clipboard image, or local image file",
  settingsSection: "Settings",
  featureSubtitle: {
    translate: "Vietnamese ⇄ English",
    reply: "Draft a reply",
    rewrite: "Fix English + learn",
    write: "Rough notes → Message / Email",
    summarize: "TL;DR + Action Items",
    ask: "Quick AI Q&A + follow-ups",
    vision: "OCR, translate & explain images",
  },
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
- **⌘R** Start over

*(Tip: Choose **Replace Immediately** in **Settings → Polish English Mode** to replace selected text directly without opening the popup.)*`,
    write: `## 📝 Buddy Write
Turns rough shorthand notes or bullet points (Vietnamese or English) into a **complete, ready-to-send chat message or email**, faithfully keeping all your facts.

### How to use
1. Type rough notes in Slack / Gmail (e.g. \`off tomorrow morning family matter, task A PR ready, call if urgent\`), select them, and press the hotkey
2. Default (**Replace Immediately**): replaces the selected notes in-place without opening a popup
3. Or switch to **Show Popup** in Settings (or launch with nothing selected) to preview, switch styles, and refine

### In the preview
- **↵** Replace selection (or Copy) · **⌘T** Switch language (English ⇄ Tiếng Việt)
- **⌘1** Chat / Slack · **⌘2** Email · **⌘3** Short & Direct · **⌘4** Formal
- Type a tweak in **💡 Refine** and press **↵** to revise the current draft

*(Tip: Prefix notes with cues like \`email:\` or \`en:\` to force email format or English on the fly.)*`,
    summarize: `## 📋 Buddy Summarize
Condenses long Slack/Teams threads, emails, docs, or specs into a clean **TL;DR**, **Key Points**, and **Action Items** (when present).

### How to use
1. Select a thread, email, or document in any app
2. Press the hotkey: the structured summary streams right away

Or paste text in the search bar above and press **↵**.

### In the result
- **↵** Copy summary · **⌘⇧V** Paste in app
- **⌘T** Switch summary language (English ⇄ Tiếng Việt) · **⌘R** Summarize again`,
    ask: `## 💬 Buddy Ask
Fast AI Q&A right inside Raycast — supports multi-turn follow-ups and automatically attaches selected text as context.

### How to use
1. **Quick question:** Open Raycast → type \`Buddy Ask\` → enter your question → **↵**
2. **Ask about selected text:** Highlight code, logs, or an email → press the hotkey → type a question (or press **⌘1** Explain · **⌘2** Find Bugs · **⌘3** Key Takeaways)

### In the result
- **↵** Copy answer · **⌘↵** Ask follow-up
- **⌘⇧V** Paste in app · **⌘⇧K** Copy code block (when present)
- **⌘R** Regenerate · **⌘N** New question`,
    vision: `## 👁️ Buddy Vision
Capture any screen region (or load an image from Clipboard / File) to **extract text (OCR), translate, explain UI errors/diagrams, or summarize**.

### How to use
1. Press the hotkey → drag to capture a screen region (press **Space** for a window, **Esc** to cancel)
2. The image preview and AI analysis stream immediately
3. Or use **Analyze Clipboard Image** (**⌘↵**) / **Choose Image File** (**⌘O**)

### In the result
- **↵** Copy result · **⌘↵** Ask a question about this image
- **⌘1** OCR · **⌘2** Translate · **⌘3** Explain · **⌘4** Summarize
- **⌘T** Toggle image preview · **⌘N** Capture new region · **⌘B** Use clipboard image

*(Note: Requires a vision-capable model such as **Google Gemini** or **OpenAI**. macOS will ask for **Screen Recording** permission for Raycast on first capture.)*`,
  },
  promptsSubtitle: "Customize each buddy's prompt",
  promptsGuide: `## ✍️ Prompts
Press **↵** to view and edit each buddy's prompt: role, tone, pronoun rules, examples…

- **Translate** - sentences and paragraphs
- **Dictionary Lookup** - the dictionary card for words / phrases of ≤ 3 words
- **Draft Reply** - reply drafts
- **Polish English** - English fixes + lessons
- **Write** - expand rough notes into a complete message or email
- **Summarize** - TL;DR, key points & action items
- **Ask** - quick Q&A + follow-ups
- **Vision** - screenshot & image analysis
- **Vocabulary** - the Vocabulary panel for sentences

The output format is kept fixed by the code, so edits can't break the screens. The default can always be restored (**⌃X**).

Saved in \`prompts.json\` in the Data Folder.`,
  settingsSubtitle: "Provider, API key, model, language, hotkeys",
  settingsGuide: `## ⚙️ Settings
Press **↵** to open AI Buddy's settings in Raycast:

- **Active Provider** - switch between **Google Gemini**, **Groq**, **OpenAI**, or **Custom** (Cerebras, OpenRouter, Ollama…)
- **API Key & Model** - configured per provider below; API keys are stored securely by Raycast (Keychain)
- **Language** - interface language: Tiếng Việt / English
- **Polish English Mode** - choose between Show Popup or Replace Immediately
- **Buddy Write Mode & Language** - replace selected notes immediately or open popup, and choose default output language (Auto / English / Tiếng Việt)
- **Vision Default Action** - default action when capturing an image with Buddy Vision (Explain / OCR / Translate / Summarize)
- **Hotkey** - assign a hotkey to each command under Commands
- **Voice** - the macOS system voice (Accessibility → Read & Speak)

### Data on this Mac
- **Looked-up words** (meaning, IPA, usage, examples) - kept so they show instantly next time ⚡
- **Edited prompts** - \`prompts.json\`
- ⌘K → **Show Data Folder** to view · **Clear Dictionary Cache** to delete

Suggested hotkeys: **⌃⌘T** Translate · **⌃⌘R** Draft Reply · **⌃⌘E** Polish English · **⌃⌘W** Write · **⌃⌘S** Summarize · **⌃⌘A** Ask · **⌃⌘V** Vision`,

  promptSubtitle: {
    translate: "Sentences and paragraphs",
    lookup: "Words / phrases of ≤ 3 words",
    reply: "Reply drafts",
    rewrite: "English fixes + lessons",
    write: "Rough notes → complete message or email",
    summarize: "TL;DR, key points & action items",
    ask: "Quick Q&A + follow-ups",
    vision: "Screenshot & image analysis",
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
    write: "Type a tweak (e.g. more polite, shorter, add a thank-you…), then ↵",
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
  notConfigured: "⚠️ Not configured",
  summaryLanguage: "Language",
  originalLength: "Original length",
  formatLength: (words, chars) => `${words.toLocaleString("en-US")} words · ${chars.toLocaleString("en-US")} chars`,

  writeNotesField: "📝 Rough Notes",
  writeNotesPlaceholder: "e.g. off tomorrow morning family matter, task A PR is up, call if urgent…",
  writeStyleField: "🎨 Style",
  writeLanguageField: "🌐 Output Language",
  writeRefineField: "💡 Refine",
  writeEmptyError: "Please enter your rough notes",
  writeFormHint: "Press ⌘↵ to write · shorthand Vietnamese or English bullets both work.",
  writeShortcutHint: "⌘1 Chat · ⌘2 Email · ⌘3 Short · ⌘4 Formal · ⌘T English ⇄ Tiếng Việt",
  writeStyleLabel: {
    chat: "💬 Chat / Slack",
    email: "📧 Email (with Subject)",
    concise: "⚡ Short & Direct",
    formal: "🎩 Formal & Polite",
  },
  writeLanguageLabel: {
    auto: "Auto (Match Notes)",
    en: "English",
    vi: "Tiếng Việt",
  },

  askQuestionField: "❓ Question",
  askContextField: "📎 Context (optional)",
  askPlaceholder: "Ask anything (e.g. git command to undo last commit, explain OAuth2…)",
  askWithContextPlaceholder: "Ask about the context below… (or press ⌘1 / ⌘2 / ⌘3)",
  askContextPlaceholder: "Optional code, stack trace, email, or notes for context",
  askSubmitHint: "Press ↵ (or ⌘↵) to ask.",
  askQuickPresetHint: "↵ Ask · ⌘1 Explain · ⌘2 Find Bugs · ⌘3 Key Takeaways",
  askEmptyError: "Please enter a question",
  askFollowUpTitle: "Follow-up Question",
  askFollowUpPlaceholder: "Ask a follow-up question in this conversation…",
  askTurns: "Turns",
  askContextLabel: "Context",
  askContextAttached: "📎 Attached Context",

  visionActionField: "Action",
  visionSourceField: "Source",
  visionImageField: "Image",
  visionCustomQuestionField: "💬 Custom Question (optional)",
  visionAskTitle: "Ask about Image",
  visionAskPlaceholder: "e.g. convert this table to Markdown, why is this error happening…",
  visionPickFileError: "Please choose an image file",
  visionNoClipboard: "No image found in Clipboard",
  visionFormHint: "Pick an image and press ⌘↵ · or ⌘N Capture Screen · ⌘B Use Clipboard Image.",
  visionSwitchSection: "Switch Action on This Image",
  visionSourceSection: "Image & Other Sources",
  visionActionLabel: {
    explain: "🔍 Explain",
    ocr: "📝 Extract Text (OCR)",
    translate: "🌐 Translate",
    summarize: "📋 Summarize",
    ask: "💬 Ask about Image",
  },
  visionSourceLabel: {
    screen: "Screen Capture",
    clipboard: "Clipboard",
    file: "Image File",
  },
};

export const getLanguage = (): Language =>
  getPreferenceValues<{ language?: Language }>().language === "en" ? "en" : "vi";

/** Strings for the language chosen in Settings (read on each render, so a change applies on reopen). */
export const ui = (): Strings => (getLanguage() === "en" ? en : vi);
