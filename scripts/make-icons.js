/* eslint-disable */
/**
 * Icônes PNG de l'application (192, 512, 512 maskable) dessinées sans aucune bibliothèque :
 * fond émeraude arrondi, chapeau de diplômé or, livre ouvert blanc, ruban émeraude.
 * Lancer : node scripts/make-icons.js   (écrit dans public/icons/)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Petit rasterizer : formes en coordonnées 0..100 (comme le logo SVG), sur-échantillonnage 4×4.
const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inRoundRect = (x, y, w, h, r, px, py) => {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r)), cy = Math.max(y + r, Math.min(py, y + h - r));
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
};
const inCircle = (cx, cy, r, px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
// Distance à un segment (pour les traits arrondis)
const nearSeg = (ax, ay, bx, by, w, px, py) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2 <= (w / 2) ** 2;
};
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function bezierPts(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]);
  }
  return out;
}
// Pages du livre (courbes du logo), en polygones
const leftPage = [[50, 48], ...bezierPts([50, 48], [42, 42], [26, 44], [18, 50]).slice(1), [18, 76], ...bezierPts([18, 76], [26, 70], [42, 68], [50, 74]).slice(1)];
const rightPage = [[50, 48], ...bezierPts([50, 48], [58, 42], [74, 44], [82, 50]).slice(1), [82, 76], ...bezierPts([82, 76], [74, 70], [58, 68], [50, 74]).slice(1)];
const cap = [[50, 18], [86, 33], [50, 48], [14, 33]];
const star = [[50, 22], [52, 28], [58, 28], [53, 32], [55, 38], [50, 34], [45, 38], [47, 32], [42, 28], [48, 28]];
const ribbon = bezierPts([24, 64], [34, 58], [42, 62], [50, 67]).concat(bezierPts([50, 67], [58, 72], [66, 68], [76, 62]));

function colorAt(u, v, maskable) {
  // u, v dans 0..100 (toute l'icône). Fond : carré arrondi (ou plein si maskable).
  const bgT = (u + v) / 200;
  const bg = bgT < 0.6 ? mix([5, 150, 105], [4, 120, 87], bgT / 0.6) : mix([4, 120, 87], [15, 23, 42], (bgT - 0.6) / 0.4);
  const onBg = maskable || inRoundRect(0, 0, 100, 100, 22, u, v);
  if (!onBg) return null;
  let c = bg;
  if (inCircle(84, 14, 17.5, u, v)) c = mix(c, [255, 255, 255], 0.18);
  // Logo : zone 11..89 (maskable : plus petit, zone de sécurité)
  const s = maskable ? 0.62 : 0.78, off = (100 - 100 * s) / 2;
  const x = (u - off) / s, y = (v - off) / s;
  if (x < 0 || x > 100 || y < 0 || y > 100) return c;
  const page = mix([255, 255, 255], [226, 232, 240], (x + y) / 200);
  if (inPoly(leftPage, x, y)) c = mix(c, page, 0.95);
  if (inPoly(rightPage, x, y)) c = page;
  if (nearSeg(50, 48, 50, 82, 4, x, y)) c = [4, 120, 87];
  for (let i = 1; i < ribbon.length; i++) if (nearSeg(ribbon[i - 1][0], ribbon[i - 1][1], ribbon[i][0], ribbon[i][1], 3.5, x, y)) c = mix([52, 211, 153], [5, 150, 105], x / 100);
  if (inPoly(cap, x, y)) c = mix([253, 224, 71], [245, 158, 11], (x + y) / 200);
  // Contour blanc du chapeau
  const capEdge = [[50, 18], [86, 33], [50, 48], [14, 33], [50, 18]];
  for (let i = 1; i < capEdge.length; i++) if (nearSeg(capEdge[i - 1][0], capEdge[i - 1][1], capEdge[i][0], capEdge[i][1], 2.5, x, y)) c = [255, 255, 255];
  if (nearSeg(76, 37, 76, 56, 3.5, x, y) || nearSeg(76, 56, 71, 60, 3.5, x, y)) c = [245, 158, 11];
  if (inCircle(71, 62, 3.5, x, y)) c = [245, 158, 11];
  if (inPoly(star, x, y)) c = [255, 255, 255];
  return c;
}

function render(size, maskable) {
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = ((px + (sx + 0.5) / SS) / size) * 100, v = ((py + (sy + 0.5) / SS) / size) * 100;
        const c = colorAt(u, v, maskable);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      const cov = a / n / 255;
      out[i] = cov ? Math.round(r / n / cov) : 0;
      out[i + 1] = cov ? Math.round(g / n / cov) : 0;
      out[i + 2] = cov ? Math.round(b / n / cov) : 0;
      out[i + 3] = Math.round(a / n);
    }
  }
  return png(size, size, out);
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), render(192, false));
fs.writeFileSync(path.join(dir, 'icon-512.png'), render(512, false));
fs.writeFileSync(path.join(dir, 'icon-maskable-512.png'), render(512, true));
fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), render(180, true));
console.log('Icônes écrites dans', dir);
