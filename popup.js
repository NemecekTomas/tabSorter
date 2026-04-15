// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
    sortOrder:    'asc',       // 'asc' | 'desc'
    withinDomain: 'original',  // 'original' | 'title' | 'url'
    scope:        'window',    // 'window' | 'all'
    keepPinned:   true,
    keepActive:   true,
    autoSort:     false,
};

let settings = { ...DEFAULTS };

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
    settings = { ...DEFAULTS, ...stored };
    applySettingsToUI();
    await updateTabCount();
    setupListeners();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function applySettingsToUI() {
    document.querySelector(`input[name="sortOrder"][value="${settings.sortOrder}"]`).checked = true;
    document.querySelector(`input[name="withinDomain"][value="${settings.withinDomain}"]`).checked = true;
    document.querySelector(`input[name="scope"][value="${settings.scope}"]`).checked = true;

    document.getElementById('keepPinned').checked = settings.keepPinned;
    document.getElementById('keepActive').checked  = settings.keepActive;
    document.getElementById('autoSort').checked    = settings.autoSort;
}

async function updateTabCount() {
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const allWindows    = await chrome.windows.getAll({ populate: true });

    const windowTabs = currentWindow.tabs.length;
    const totalTabs  = allWindows.reduce((n, w) => n + w.tabs.length, 0);
    const winCount   = allWindows.length;

    const el = document.getElementById('tabCountText');

    if (settings.scope === 'all' && winCount > 1) {
        el.innerHTML = `<strong>${totalTabs} tabs</strong> across ${winCount} windows`;
    } else {
        el.innerHTML = `<strong>${windowTabs} tab${windowTabs !== 1 ? 's' : ''}</strong> open in this window`;
    }
}

// ── Listeners ─────────────────────────────────────────────────────────────────

function setupListeners() {
    document.getElementById('sortButton').addEventListener('click', handleSort);
    document.getElementById('settingsToggle').addEventListener('click', toggleSettings);

    document.querySelectorAll('input[type="radio"]').forEach(el => {
        el.addEventListener('change', onSettingChange);
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', onSettingChange);
    });
    document.querySelectorAll('input[name="scope"]').forEach(el => {
        el.addEventListener('change', updateTabCount);
    });
}

function onSettingChange(e) {
    const { name, id, type, value, checked } = e.target;

    if (type === 'radio') {
        settings[name] = value;
    } else {
        settings[id] = checked;
        if (id === 'autoSort') {
            chrome.runtime.sendMessage({ type: 'AUTO_SORT_CHANGED', enabled: checked });
        }
    }

    chrome.storage.local.set(settings);
}

let settingsOpen = false;

function toggleSettings() {
    settingsOpen = !settingsOpen;
    document.getElementById('settingsPanel').classList.toggle('open', settingsOpen);
    document.getElementById('chevron').classList.toggle('open', settingsOpen);
}

// ── Sort action ───────────────────────────────────────────────────────────────

const SORT_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="15" y2="12"/>
        <line x1="3" y1="18" x2="9" y2="18"/>
        <polyline points="17 15 21 18 17 21"/>
    </svg>`;

async function handleSort() {
    const btn = document.getElementById('sortButton');
    btn.classList.add('loading');
    btn.innerHTML = SORT_ICON + ' Sorting…';

    try {
        const count = await sortTabs(settings);
        showSuccess(count);
        await updateTabCount();
    } catch (err) {
        console.error('Tab Sorter: sort failed', err);
    } finally {
        btn.classList.remove('loading');
        btn.innerHTML = SORT_ICON + ' Sort Tabs Now';
    }
}

function showSuccess(count) {
    const el   = document.getElementById('successMsg');
    const text = document.getElementById('successText');
    text.textContent = `${count} tab${count !== 1 ? 's' : ''} sorted`;
    el.style.display = 'flex';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ── Sorting logic ─────────────────────────────────────────────────────────────

function getDomain(url) {
    if (!url) return '\uffff';
    try {
        const { protocol, hostname } = new URL(url);
        // Push browser-internal pages to the very end
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
        const cmp = s.sortOrder === 'desc'
            ? db.localeCompare(da)
            : da.localeCompare(db);
        if (cmp !== 0) return cmp;

        switch (s.withinDomain) {
            case 'title': return (a.title || '').localeCompare(b.title || '');
            case 'url':   return (a.url   || '').localeCompare(b.url   || '');
            default:      return 0;
        }
    };
}

async function sortTabs(s) {
    let windows;
    if (s.scope === 'all') {
        windows = await chrome.windows.getAll({ populate: true });
    } else {
        windows = [await chrome.windows.getCurrent({ populate: true })];
    }

    let total = 0;
    for (const win of windows) {
        total += await sortWindow(win.tabs, s);
    }
    return total;
}

async function sortWindow(tabs, s) {
    const pinned   = s.keepPinned ? tabs.filter(t => t.pinned)  : [];
    const sortable = s.keepPinned ? tabs.filter(t => !t.pinned) : [...tabs];
    const start    = pinned.length;

    const activeTab      = tabs.find(t => t.active);
    const activeOrigIdx  = activeTab ? sortable.indexOf(activeTab) : -1;

    const sorted = [...sortable].sort(makeComparator(s));

    // Restore active tab to its original position within the sortable group
    if (s.keepActive && activeTab && activeOrigIdx !== -1) {
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
            // Skip tabs that cannot be moved (e.g. chrome:// pages in some configs)
        }
    }

    return sorted.length;
}

// ── Start ─────────────────────────────────────────────────────────────────────

init();
