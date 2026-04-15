# Tab Sorter

A Chrome extension that sorts your open tabs by domain with a single click.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

---

## Features

### Sort Tabs by Domain
Tabs are grouped and sorted alphabetically by their hostname (e.g. `github.com`, `google.com`, `youtube.com`). The `www.` prefix is ignored so `www.github.com` and `github.com` are treated as the same domain.

### Domain Order
Choose the direction of sorting:
- **A → Z** — alphabetical ascending (default)
- **Z → A** — alphabetical descending

### Within Same Domain
When multiple tabs share the same domain, you can control their internal order:
- **Original** — tabs stay in the order they were opened (default)
- **Title** — tabs are sorted alphabetically by page title
- **URL** — tabs are sorted alphabetically by full URL

### Scope
Choose which tabs are affected:
- **This window** — only the tabs in the current browser window are sorted (default)
- **All windows** — tabs in every open browser window are sorted simultaneously

### Keep Pinned Tabs
When enabled (default: on), pinned tabs are never moved — they stay locked at the beginning of the tab strip regardless of sorting.

### Keep Active Tab in Place
When enabled (default: on), the tab you are currently viewing stays at its original position. All other tabs are sorted around it so your context is not disrupted.

### Auto-Sort on Tab Change
When enabled (default: off), the extension automatically re-sorts tabs whenever a tab is opened, closed, or navigated to a new URL. A 1-second debounce prevents excessive movement when multiple tabs change at once.

---

## Installation

1. Download or clone this repository.
2. Run `node generate-icons.js` to generate the PNG icons (requires Node.js).
3. Open `chrome://extensions/` in Chrome.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `tabSorter` folder.

---

## Project Structure

```
tabSorter/
├── manifest.json       — Extension manifest (Manifest V3)
├── popup.html          — Popup UI
├── popup.js            — Popup logic: settings, tab counting, sort trigger
├── background.js       — Service worker: auto-sort listener
├── generate-icons.js   — Generates icons/icon16|48|128.png (run with Node.js)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission | Reason |
|------------|--------|
| `tabs` | Read tab URLs and titles, move tabs to new positions |
| `storage` | Persist user settings between sessions |

No data ever leaves your browser.

---

## Related

- [BookmarkDuplicateFinder](https://github.com/NemecekTomas/bookmarkDuplicateFinder) — Find and remove duplicate bookmarks
