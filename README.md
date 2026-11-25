# AI Buddy

AI Buddy is a Raycast extension for macOS that supports Vietnamese ⇄ English translation, English reply drafting, and English writing refinement using any OpenAI-compatible LLM.

## Prerequisites

- **macOS**
- **Raycast**: Download and install Raycast from [raycast.com](https://www.raycast.com), then launch it at least once.
- **API Key**: Provided separately by your administrator or the sender (not included in this repository or archive). You may also configure your own OpenAI-compatible API endpoint and key in Raycast preferences.

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
2. When Raycast prompts you for your **API Key**, paste the key you received and click **Continue**.
3. *(Optional)* To switch the interface language to English, navigate to **Buddy Home → Settings → Language** and select **English**.

## Recommended Hotkeys

Assigning hotkeys makes AI Buddy significantly faster to use. Open **Raycast → Settings (`⌘ + ,`) → Extensions → AI Buddy**, then click the **Hotkey** field for each command:

| Command | Recommended Hotkey | Description |
| :--- | :---: | :--- |
| **Buddy Translate** | `⌃⌘T` | Translate the selected text (Vietnamese ⇄ English) |
| **Buddy Draft Reply** | `⌃⌘R` | Draft an English reply based on the selected message |
| **Buddy Polish English** | `⌃⌘E` | Refine and polish the selected English draft |

## Usage

- Highlight text in any application and press the corresponding hotkey.
- If no text is selected, AI Buddy opens an input dialog where you can type or paste your text directly.
- On first use of a hotkey, macOS may ask for **Accessibility** permission for Raycast. Please grant this permission so Raycast can read your selected text.

## Updating

To update to a newer version, pull the latest changes (or extract the new archive) and run `install.command` again by following the **Installation** steps above. Your existing hotkeys, API key, and settings will be preserved.

## Troubleshooting

- **Error `401` / Invalid API Key**: Open **Buddy Home → Settings** and re-enter your API key.
- **Other Issues**: Capture a screenshot of the error message and share it with the maintainer or the person who distributed the package.
