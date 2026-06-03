# TAA — Token & Limit Tracker for Claude.ai

A small, fully local Chrome extension that shows, while you use claude.ai:

- **Your usage limits, exact.** Claude reports your rate-limit usage (5-hour and 7-day windows) in its own response data. TAA reads those exact numbers and shows them, so you can see how close you are to a limit before you hit it.
- **A rough context-size estimate.** An approximate count of the readable text in the current chat, so you get a directional sense of how big a conversation is getting.
- **Subscription vs API value math.** A simple calculator to see whether your subscription or paying per token is cheaper for your usage.

Everything is computed in your browser. There is **no server, no account, no API key, and nothing is ever sent anywhere.**

## What it honestly cannot do

This matters, so it's stated plainly:

- **It cannot count tokens exactly.** Claude's tokenizer is not public, and claude.ai's web app does not expose per-message token counts (the usage fields are stripped from its response stream). The context number is an estimate based on readable text (~4 characters per token).
- **The estimate undercounts.** It does not include images, uploaded documents, artifacts, or system overhead, all of which consume real context. So the true context is always higher than the estimate.
- **The only exact token count comes from Anthropic's paid `count_tokens` API**, which this extension deliberately does not use, to keep everything free and local.

The one number here that *is* exact is the usage-limit percentage, because Claude reports it directly.

## Install (developer mode)

1. Download or clone this repo to a local folder (not inside a synced folder like OneDrive).
2. Go to `chrome://extensions`, turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Open claude.ai. A badge appears bottom-right; send a message to capture your limits.

## How it works

- A content script reads a copy of the data the page already loads, only on `claude.ai`.
- The usage limits come from the completion response stream Claude sends back.
- The context estimate comes from the conversation text and the visible page.
- Readings are stored locally in the browser via `chrome.storage`.

## Privacy

No network requests are made by the extension. It only reads copies of responses your browser already received from claude.ai. It stores nothing outside your own browser.

## License

MIT. See [LICENSE](LICENSE).
