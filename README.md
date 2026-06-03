# TAA — Claude Usage Tracker

A tiny, fully local Chrome extension that tells you, in plain English, **how much of your Claude usage is left and when it resets**, while you're on claude.ai.

- **Usage left**: Claude reports your exact usage in every reply. TAA shows it simply: "73% left, refills in 3h 58m." A badge on the page and a popup keep it in view so you know before you get paused.
- **This chat's size**: a rough sense of how long the current chat is getting.

Everything is computed in your browser. **No server, no account, no API key, nothing leaves your machine.**

## What it does not do

- It does **not** count tokens exactly. Claude's tokenizer isn't public and the web app doesn't expose token counts, so the chat size is a rough estimate of readable text only (it excludes images, files, and system overhead, so the real size is larger).
- The one number that **is** exact is your usage-left percentage, because Claude reports it directly.

## Install

1. Download/clone this repo to a local folder (not a synced folder like OneDrive).
2. Go to `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder with `manifest.json`.
4. Open claude.ai and send a message, your usage appears.

## Privacy

The extension makes no network requests. It only reads copies of responses your browser already gets from claude.ai, and stores readings locally.

## License

MIT. See [LICENSE](LICENSE).
