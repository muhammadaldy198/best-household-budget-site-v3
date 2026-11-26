// RumahHitung — grafik SVG yang digambar tangan dari data.
// Tanpa library, tanpa canvas: tiap grafik adalah <svg> dengan angka yang
// sama persis dengan angka di tabel.

export function donut(parts, size = 180) {
  // parts: [{ label, value, color }]. Lingkaran penuh = total.
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map((p) => {
    const frac = p.value / total;
    const len = frac * circ;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" />`;
    offset += len;
    return s;
  }).join("");
  const pct = Math.round((parts[0].value / total) * 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Donat pembagian pengeluaran: ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)} persen`).join(", ")}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e7dfcb" stroke-width="26" />
    <g transform="rotate(-90 ${cx} ${cy})">${arcs}</g>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="26" font-weight="700" fill="#1e2a24">${pct}%</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#4c5a52">${parts[0].label}</text>
  </svg>`;
}

export function ring(pct, size = 84, color = "#1f6b4a") {
  // Cincin progres 0–100% untuk satu tujuan.
  const r = 34;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${Math.round(clamped)} persen tercapai">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e7dfcb" stroke-width="9" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${(clamped / 100 * circ).toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#1e2a24">${Math.round(clamped)}%</text>
  </svg>`;
}

export function bars(rows, width = 560, height = 220) {
  // rows: [{ label, a, b }] — dua batang per label (terpakai vs pemasukan).
  const max = Math.max(...rows.map((r) => Math.max(r.a, r.b)), 1);
  const padL = 8;
  const padB = 26;
  const padT = 14;
  const plotH = height - padB - padT;
  const slot = (width - padL * 2) / rows.length;
  const bw = Math.min(26, slot / 3);
  const fmt = (n) => (n / 1000000).toFixed(1).replace(".", ",") + " jt";
  let out = `<svg width="100%" viewBox="0 0 ${width} ${height}" role="img" aria-label="Batang bulanan pemasukan lawan pengeluaran">`;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i) / 4;
    const v = max * (1 - i / 4);
    out += `<line x1="${padL}" y1="${y}" x2="${width - padL}" y2="${y}" stroke="#e7dfcb" stroke-width="1" />`;
    out += `<text x="${padL}" y="${y - 3}" font-size="10" fill="#4c5a52">${fmt(v)}</text>`;
  }
  rows.forEach((r, i) => {
    const x = padL + slot * i + slot / 2;
    const ha = (r.a / max) * plotH;
    const hb = (r.b / max) * plotH;
    out += `<rect x="${(x - bw - 2).toFixed(1)}" y="${(padT + plotH - ha).toFixed(1)}" width="${bw}" height="${ha.toFixed(1)}" rx="2" fill="#1f6b4a"><title>${r.label}: terpakai ${fmt(r.a)}</title></rect>`;
    out += `<rect x="${(x + 2).toFixed(1)}" y="${(padT + plotH - hb).toFixed(1)}" width="${bw}" height="${hb.toFixed(1)}" rx="2" fill="#d8cfb8"><title>${r.label}: pemasukan ${fmt(r.b)}</title></rect>`;
    out += `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#1e2a24">${r.label}</text>`;
  });
  out += "</svg>";
  return out;
}

export function lineChart(points, width = 560, height = 200) {
  // points: [{ label, value }] — garis tren satu seri.
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const padL = 46;
  const padR = 12;
  const padT = 22;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const xy = points.map((p, i) => {
    const x = padL + (plotW * i) / (points.length - 1);
    const y = padT + plotH * (1 - (p.value - min) / span);
    return [x, y];
  });
  const path = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#1f6b4a"><title>${points[i].label}: Rp ${points[i].value.toLocaleString("id-ID")}</title></circle>`).join("");
  const labels = xy.map(([x], i) => `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#1e2a24">${points[i].label}</text>`).join("");
  const fmt = (n) => "Rp " + (n / 1000000).toFixed(1).replace(".", ",") + " jt";
  return `<svg width="100%" viewBox="0 0 ${width} ${height}" role="img" aria-label="Garis tren tabungan bulanan">
    <text x="${padL}" y="${padT - 4}" font-size="10" fill="#4c5a52">${fmt(max)}</text>
    <text x="${padL}" y="${padT + plotH + 2}" font-size="10" fill="#4c5a52">${fmt(min)}</text>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#d8cfb8" />
    <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="#d8cfb8" />
    <path d="${path}" fill="none" stroke="#1f6b4a" stroke-width="2.5" />
    ${dots}${labels}
  </svg>`;
}
