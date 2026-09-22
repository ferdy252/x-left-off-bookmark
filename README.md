# 📖 X Left-Off Bookmark

Leave a book-style bookmark on X so you never lose where you left off reading.

Built for a news-only X account with notifications on — when the flood of posts
keeps pushing everything down, mark your spot, leave, come back, jump right to it.

![firefox](https://img.shields.io/badge/firefox-addon-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## What it does

- Small box bottom-right on X: **Mark here / Go to mark / Clear**
- Every post gets a tiny `🔖 mark` button on hover
- Blue line where you stopped: `▼ YOU LEFT OFF HERE ▼`
- One bookmark per place — Notifications has its own, Home has its own
- Saved on your computer only. No account, no server, no tracking.

Works on `x.com` and `twitter.com`.

## Install it (Firefox)

**Easy way (for you right now):**
1. Download the latest release zip
2. Unzip it
3. Firefox address bar → `about:debugging#/runtime/this-firefox`
4. `Load Temporary Add-on` → pick `manifest.json`

**Permanent way (signed by Mozilla):**
This repo is ready to submit to https://addons.mozilla.org (AMO).
Upload the zip from `Releases` as a new listing, Mozilla signs it, then
you get a normal install link that survives restarts.

## Use it

1. Go to https://x.com/notifications
2. Reading, need to stop? Hit **Mark here**
3. Come back later? See the blue line. Hit **Go to mark** to jump to it.
4. Want a new spot? **Clear**, then **Mark here** again.

## Files

- `manifest.json` — Firefox plug-in ID card
- `content.js` — what it does on the X page
- `bookmark.css` — how the box + blue line look
- `icons/` — store icons

## Privacy

Runs only on x.com / twitter.com. Marks live in `browser.storage.local`
on your machine. No analytics, no network calls.

## Contribute

PRs welcome. Keep it simple, plain-English comments.

## License

MIT — do whatever you want, just keep the notice.
