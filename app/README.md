# AI Buddy

AI Buddy is a fast, bring-your-own-key (BYOK) AI toolkit for macOS in Raycast. Translate between Vietnamese and English, draft replies, polish English writing with grammar lessons, expand rough notes into complete messages or emails, summarize long threads, ask multi-turn questions, and analyze screenshots or images using **Google Gemini**, **Groq**, **OpenAI**, or any **OpenAI-compatible** endpoint (including local Ollama).

## Features

- **Buddy Translate** — Bidirectional Vietnamese ⇄ English translation with dictionary cards, IPA pronunciation, macOS speech playback (`⌘L`), and vocabulary breakdown.
- **Buddy Draft Reply** — Context-aware reply drafting from selected messages with iterative refinement using your own ideas.
- **Buddy Polish English** — Improves grammar and natural phrasing with actionable lessons; supports both **Show Popup** and **Replace Immediately** modes.
- **Buddy Write** — Turns rough shorthand notes or bullet points (Vietnamese or English) into ready-to-send Chat/Slack messages or emails, replacing in-place by default or opening a preview popup with style (`⌘1`–`⌘4`) and language (`⌘T`) toggles.
- **Buddy Summarize** — Condenses long chat threads, emails, or documents into **TL;DR**, **Key Points**, and **Action Items** with one-key language switching (`⌘T`).
- **Buddy Ask** — Fast multi-turn AI Q&A with optional selected-text context and quick presets (`Explain`, `Find Bugs`, `Key Takeaways`).
- **Buddy Vision** — Capture a screen region, use a clipboard image, or pick a file to **Explain**, **Extract Text (OCR)**, **Translate**, **Summarize**, or ask custom follow-up questions *(requires a vision-capable model such as Google Gemini or OpenAI)*.
- **Buddy Home** — Central hub with quick launch, live provider status, and a built-in **Custom Prompts** editor for all commands.

## Setup

1. Open **Buddy Home** (or any AI Buddy command) and open **Extension Preferences** (`⌘ + Shift + ,`).
2. Select your **Active Provider** (**Google Gemini**, **Groq**, **OpenAI**, or **Custom**).
3. Enter the corresponding **API Key** (and optionally customize the **Model**):
   - **Google Gemini**: Get an API key from [Google AI Studio](https://aistudio.google.com/).
   - **Groq**: Get an API key from [Groq Console](https://console.groq.com/).
   - **OpenAI**: Get an API key from [OpenAI Platform](https://platform.openai.com/).
   - **Custom**: Enter any OpenAI-compatible Base URL (e.g. Cerebras, OpenRouter, LiteLLM, or local Ollama at `http://localhost:11434/v1`).
4. *(Optional)* Switch the interface language between **English** and **Tiếng Việt** under **Language**.
5. *(Optional)* Add a free [Merriam-Webster Learner's Dictionary](https://dictionaryapi.com/) API key for richer IPA dictionary lookups in **Buddy Translate** (otherwise Wiktionary / AI is used automatically).

## Recommended Hotkeys

Assign hotkeys in **Raycast → Settings → Extensions → AI Buddy** for instant, selection-based workflows:

| Command | Suggested Hotkey |
| :--- | :---: |
| **Buddy Translate** | `⌃⌘T` |
| **Buddy Draft Reply** | `⌃⌘R` |
| **Buddy Polish English** | `⌃⌘E` |
| **Buddy Write** | `⌃⌘W` |
| **Buddy Summarize** | `⌃⌘S` |
| **Buddy Ask** | `⌃⌘A` |
| **Buddy Vision** | `⌃⌘V` |

## Permissions & Requirements

- **macOS only** (uses native macOS `screencapture`, `sips`, and speech synthesis).
- **Accessibility permission** for Raycast is used to read selected text and paste replacements in-place.
- **Screen Recording permission** for Raycast is required only when using **Buddy Vision** screen capture.

## Privacy

AI Buddy sends selected text or captured images directly from your Mac to the AI provider endpoint you configure in Preferences. No intermediary proxy or telemetry server is used.
