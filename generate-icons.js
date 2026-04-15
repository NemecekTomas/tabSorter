// generate-icons.js
// Generates icon16.png, icon48.png, icon128.png for the Tab Sorter extension.
// Run: node generate-icons.js

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── Minimal PNG encoder ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
    const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const tb   = Buffer.from(type);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([tb, data])));
    return Buffer.concat([len, tb, data, crcB]);
}

function makePNG(rgba, w, h) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

    const stride = w * 4 + 1;
    const raw = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) {
        raw[y * stride] = 0;
        for (let x = 0; x < w; x++) {
            const s = (y * w + x) * 4, d = y * stride + 1 + x * 4;
            raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
        }
    }

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

// ── Tab Sorter icon shape (24×24 SVG space) ───────────────────────────────────
//
//  ┌─────────┐ ┌──────┐       ← two tab nubs at top
//  └─────────────────────┐
//  │   browser content   │    ← main rectangle body
//  └─────────────────────┘
//
// Plus a small sort-arrow on the right side of the content area.

function insideTabSorter(sx, sy) {
    // Main content area
    if (sx >= 2.5 && sx <= 21.5 && sy >= 7.5 && sy <= 20.5) return true;

    // Left tab nub (active, taller)
    if (sx >= 2.5 && sx <= 11 && sy >= 4 && sy <= 7.5) return true;

    // Right tab nub (inactive, shorter)
    if (sx >= 13 && sx <= 19 && sy >= 5.5 && sy <= 7.5) return true;

    return false;
}

// Sort-arrow overlay: three horizontal bars of decreasing length on the right
// side — drawn as a separate, slightly lighter colour to keep it readable.
function insideSortArrow(sx, sy) {
    // Only drawn inside the content area (right side: sx 14..21, sy 10..19)
    // Bar 1 (longest): y ∈ [10, 11.5]
    if (sy >= 10 && sy <= 11.5 && sx >= 13 && sx <= 21) return true;
    // Bar 2 (medium): y ∈ [13.5, 15]
    if (sy >= 13.5 && sy <= 15 && sx >= 15 && sx <= 21) return true;
    // Bar 3 (short): y ∈ [17, 18.5]
    if (sy >= 17 && sy <= 18.5 && sx >= 17.5 && sx <= 21) return true;
    return false;
}

function renderIcon(size) {
    const pixels = new Uint8Array(size * size * 4);
    const scale  = size / 24;

    const BG     = [232, 240, 254, 255]; // #e8f0fe  light-blue bg
    const FG     = [ 26, 115, 232, 255]; // #1a73e8  blue tabs shape
    const ARROW  = [255, 255, 255, 220]; // white-ish sort bars

    const r = size * 0.22;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;

            // Rounded-square background
            const cx = Math.min(x, size - 1 - x);
            const cy = Math.min(y, size - 1 - y);
            let alpha = 255;
            if (cx < r && cy < r) {
                const dist = Math.sqrt((r - cx) ** 2 + (r - cy) ** 2);
                if (dist >= r + 0.5)      { alpha = 0; }
                else if (dist >= r - 0.5) { alpha = Math.round((r + 0.5 - dist) * 255); }
            }

            if (alpha === 0) continue;

            const sx = (x + 0.5) / scale;
            const sy = (y + 0.5) / scale;

            let color;
            if (insideTabSorter(sx, sy)) {
                color = insideSortArrow(sx, sy) ? ARROW : FG;
            } else {
                color = BG;
            }

            pixels[i]   = color[0];
            pixels[i+1] = color[1];
            pixels[i+2] = color[2];
            pixels[i+3] = alpha === 255 ? color[3] : Math.round(alpha * color[3] / 255);
        }
    }
    return pixels;
}

// ── Generate files ────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

[16, 48, 128].forEach(size => {
    const file = path.join(outDir, `icon${size}.png`);
    fs.writeFileSync(file, makePNG(renderIcon(size), size, size));
    console.log(`✓ icons/icon${size}.png`);
});
console.log('Done.');
