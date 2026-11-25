# AI Buddy

AI Buddy is a Raycast extension for macOS that supports Vietnamese ⇄ English translation, English reply drafting, English writing refinement, expanding rough notes into complete messages/emails, text/thread summarization, quick multi-turn AI Q&A, and screenshot/image vision analysis using any OpenAI-compatible LLM.

## Prerequisites

- **macOS**
- **Raycast**: Download and install Raycast from [raycast.com](https://www.raycast.com), then launch it at least once.
- **API Key**: An API key for one of the supported providers (**Google Gemini**, **Groq**, **OpenAI**), or a custom OpenAI-compatible endpoint (such as Cerebras, OpenRouter, or local Ollama).

> **Note:** Node.js does not need to be installed manually. If Node.js 20 or later is not detected on your system, the installer automatically downloads a private copy into `~/.ai-buddy`.

## Installation

Installation typically takes approximately 2 minutes.

### Option 1: Using Terminal (Recommended)

1. Clone this repository or extract the downloaded archive (`AI-Buddy.zip`) to obtain the project folder.
2. Open **Terminal** (`⌘ + Space`, type `Terminal`, and press **Return**).
3. Run the installer script:
   ```bash
   bash install.command
   ```
   *(Alternatively, type `bash ` followed by a space in Terminal, drag and drop `install.command` into the Terminal window, and press **Return**.)*
4. Wait until the green confirmation message `✓ AI Buddy is installed.` appears, then press **Return** to close the window.

### Option 2: Double-Click

1. Double-click `install.command` in Finder.
2. If macOS displays a security warning stating that the file cannot be opened because it is from an unidentified developer, go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.

## Initial Configuration

1. Open **Raycast** (typically `⌥ + Space` or `⌘ + Space`), type `Buddy Home`, and press **Return**.
2. Open **Settings** (or press `⌘ + Shift + ,`) to configure your providers:
   - Choose your **Active Provider** (**Google Gemini**, **Groq**, **OpenAI**, or **Custom**).
   - Enter the corresponding **API Key** (and optionally adjust the **Model**; sensible defaults are pre-filled).
   - You can save keys for multiple providers and switch between them anytime using the **Active Provider** dropdown.
3. *(Optional)* To switch the interface language to English, set **Language** to **English**.
4. *(Optional)* To have **Buddy Polish English** replace selected text immediately without opening the popup, set **Polish English Mode** to **Replace Immediately**.
5. *(Optional)* Configure **Buddy Write Mode** (**Replace Immediately** or **Show Popup**) and **Buddy Write Language** (**Auto**, **English**, or **Tiếng Việt**).
6. *(Optional)* Choose the default mode for **Buddy Vision** under **Vision Default Action** (**Explain**, **Extract Text (OCR)**, **Translate**, or **Summarize**).

## Recommended Hotkeys

Assigning hotkeys makes AI Buddy significantly faster to use. Open **Raycast → Settings (`⌘ + ,`) → Extensions → AI Buddy**, then click the **Hotkey** field for each command:

| Command | Recommended Hotkey | Description |
| :--- | :---: | :--- |
| **Buddy Translate** | `⌃⌘T` | Translate the selected text (Vietnamese ⇄ English) |
| **Buddy Draft Reply** | `⌃⌘R` | Draft an English reply based on the selected message |
| **Buddy Polish English** | `⌃⌘E` | Refine and polish the selected English draft |
| **Buddy Write** | `⌃⌘W` | Turn rough shorthand notes into a complete chat message or email (replaces in-place by default) |
| **Buddy Summarize** | `⌃⌘S` | Summarize the selected thread, email, or document into TL;DR, key points, and action items |
| **Buddy Ask** | `⌃⌘A` | Ask AI anything with multi-turn follow-ups and optional selected-text context |
| **Buddy Vision** | `⌃⌘V` | Capture a screen region (or use Clipboard / File) to OCR, translate, explain, or summarize images |

## Usage

- Highlight text in any application and press the corresponding hotkey.
- If no text is selected, AI Buddy opens an input dialog where you can type or paste your text directly.
- For **Buddy Vision**, drag to capture a screen region (press **Space** to select a window, **Esc** to cancel), or choose **Clipboard Image** / **Choose File** in the command argument or from **Buddy Home**. Note that **Buddy Vision** requires a vision-capable model (such as Google Gemini or OpenAI).
- On first use, macOS may ask for **Accessibility** permission (to read selected text) and **Screen Recording** permission (for **Buddy Vision**) for Raycast.

## Updating

To update to a newer version, pull the latest changes (or extract the new archive) and run `install.command` again by following the **Installation** steps above. Your existing hotkeys, API keys, and settings will be preserved.

## Troubleshooting

- **Missing API Key / Error `401`**: Open **Buddy Home → Settings** (`⌘ + Shift + ,`) and verify the API key for your selected **Active Provider**.
- **Other Issues**: Capture a screenshot of the error message and share it with the maintainer.
