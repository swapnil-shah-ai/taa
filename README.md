# TAA — Claude Usage Tracker

A tiny, fully local Chrome extension that shows you, in plain English, **how much of your Claude usage is left** and **how much you've used across all your chats**, while you're on claude.ai.

## What it shows

- **How much you have left.** Claude reports your exact usage in every reply. TAA surfaces it simply: "73% left, refills in 3h 58m", plus your weekly window. A badge on the page and a popup keep it in view so you know before you get paused.
- **Your history, across all chats.** TAA reads every one of your chats and totals them up: number of chats, number of messages, a rough token estimate, and which models you used. This is your lifetime activity, a different number from how much you have left right now.
- **This chat's size.** A rough sense of how long the current chat is getting.

Everything is computed in your browser. **No server, no account, no API key, no third party.**

## What's exact and what's a rough estimate

- **Exact:** your usage-left percentage (Claude reports it directly) and your message and chat counts.
- **Rough:** the token figures. Claude's tokenizer isn't public, so token counts are estimated from readable text only. They **exclude images, files, artifacts, and system overhead**, so the real numbers are larger. Treat them as a floor, not a precise total. This part is a work in progress.

## Install

1. Download or clone this repo to a local folder (not a synced folder like OneDrive).
2. Go to `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder with `manifest.json`.
4. Open claude.ai. Send a message to see your usage-left; refresh the page to scan your history.

## Privacy

TAA talks only to claude.ai, using the session you're already logged into, to read **your own** chats. Nothing is ever sent to me or to any third party, and there is no server. All counts are computed and stored locally in your browser. Reading your chat history is not a Claude completion, so it does **not** consume your usage allowance.

## License

MIT. See [LICENSE](LICENSE).
