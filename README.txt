# X Left-Off Bookmark (for Firefox, for X)

This is your personal plug-in. It puts a little book-style bookmark on X
so you don't lose where you left off reading.

What you get:
- A small box bottom-right on X with: Mark here / Go to mark / Clear
- Every post also gets a tiny "mark" button when you hover it
- When you come back, a blue line says: ▼ YOU LEFT OFF HERE ▼
- One bookmark per place: Notifications has its own, Home has its own, etc.
- It stays saved even if you close Firefox.

## How to add it (30 seconds, do once)

1. Open Firefox
2. Go to: about:debugging#/runtime/this-firefox
3. Click "Load Temporary Add-on"
4. Pick the file: manifest.json inside the x-left-off-bookmark folder
5. Go to https://x.com/notifications — you should see the box bottom-right

That's it. No account, no setup.

Note in plain English:
- "Temporary" just means Firefox forgets it when you fully quit Firefox.
  To keep it after restart, just do those 4 clicks again once — takes 10 seconds.
- If you want it permanent (never reload), it has to be signed by Mozilla.
  Tell me and I'll package it for signing — free, just a few extra steps.
- It only runs on x.com / twitter.com. It doesn't read anything else.
- Your marks stay on your computer only.

## How to use

- Reading notifications, need to stop? Hit "Mark here" (or hover a post, hit its "mark" button).
- Come back later? You'll see the blue line where you stopped. Hit "Go to mark" to jump to it.
- Done / want a new spot? Hit "Clear", then "Mark here" in the new spot.

Files:
- manifest.json = Firefox plug-in ID card
- content.js = what it does on the X page
- bookmark.css = how the box + blue line look
