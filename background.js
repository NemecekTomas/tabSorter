// background.js — Tab Sorter service worker
// Handles auto-sort when tabs are opened, closed, or navigated.

const DEBOUNCE_MS = 1000;
let debounceTimer = null;

// ── Tab event listeners ───────────────────────────────────────────────────────

chrome.tabs.onCreated.addListener(() => scheduleAutoSort());
chrome.tabs.onRemoved.addListener(() => scheduleAutoSort());
chrome.tabs.onUpdated.addListener((_id, change) => {
    if (change.url) scheduleAutoSort();
});

// ── Message from popup ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AUTO_SORT_CHANGED' && msg.enabled) {
        scheduleAutoSort();
    }
});

// ── Debounced trigger ─────────────────────────────────────────────────────────

function scheduleAutoSort() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        const s = await chrome.storage.local.get(null);
        if (!s.autoSort) return;
        try {
            await sortAll(s);
        } catch (err) {
            console.error('Tab Sorter: auto-sort failed', err);
        }
    }, DEBOUNCE_MS);
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function getDomain(url) {
    if (!url) return '\uffff';
    try {
        const { protocol, hostname } = new URL(url);
        if (protocol === 'chrome:' || protocol === 'about:' || protocol === 'data:') {
            return '\uffff' + url;
        }
        return hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return '\uffff' + url;
    }
}

function makeComparator(s) {
    return (a, b) => {
        const da = getDomain(a.url);
        const db = getDomain(b.url);
        const cmp = (s.sortOrder || 'asc') === 'desc'
            ? db.localeCompare(da)
            : da.localeCompare(db);
        if (cmp !== 0) return cmp;

        switch (s.withinDomain || 'original') {
            case 'title': return (a.title || '').localeCompare(b.title || '');
            case 'url':   return (a.url   || '').localeCompare(b.url   || '');
            default:      return 0;
        }
    };
}

async function sortAll(s) {
    let windows;
    if ((s.scope || 'window') === 'all') {
        windows = await chrome.windows.getAll({ populate: true });
    } else {
        // Sort every normal window individually
        windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    }
    for (const win of windows) {
        await sortWindow(win.tabs, s);
    }
}

async function sortWindow(tabs, s) {
    const keepPinned = s.keepPinned !== false;
    const keepActive = s.keepActive !== false;

    const pinned   = keepPinned ? tabs.filter(t => t.pinned)  : [];
    const sortable = keepPinned ? tabs.filter(t => !t.pinned) : [...tabs];
    const start    = pinned.length;

    const activeTab     = tabs.find(t => t.active);
    const activeOrigIdx = activeTab ? sortable.indexOf(activeTab) : -1;

    const sorted = [...sortable].sort(makeComparator(s));

    if (keepActive && activeTab && activeOrigIdx !== -1) {
        const si = sorted.indexOf(activeTab);
        if (si !== -1 && si !== activeOrigIdx) {
            sorted.splice(si, 1);
            sorted.splice(activeOrigIdx, 0, activeTab);
        }
    }

    for (let i = 0; i < sorted.length; i++) {
        try {
            await chrome.tabs.move(sorted[i].id, { index: start + i });
        } catch {
            // Skip tabs that cannot be moved
        }
    }
}
