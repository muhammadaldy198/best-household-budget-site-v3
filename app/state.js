// RumahHitung — state: muat data contoh, simpan perubahan di localStorage,
// dan hitung SEMUA total dari transaksi. Tidak ada total yang disimpan:
// setiap angka di layar adalah hasil hitung ulang dari data mentah.

import { SEED } from "./data.js";

const KEY = "rumahhitung-v1";

export function rupiah(n) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.categories)) return parsed;
    }
  } catch (_) { /* rusak: jatuh ke data contoh */ }
  return structuredClone(SEED);
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* mode privat: tetap jalan */ }
}

export function resetState() {
  try { localStorage.removeItem(KEY); } catch (_) {}
  return structuredClone(SEED);
}

// --- Hitungan turunan: satu-satunya tempat total dihitung. ---
export function spentByCategory(state) {
  const out = {};
  for (const c of state.categories) out[c.id] = 0;
  for (const [/* day */, /* merchant */, cat, amount] of state.transactions) {
    if (out[cat] === undefined) out[cat] = 0;
    out[cat] += amount;
  }
  return out;
}

export function totals(state) {
  const spent = spentByCategory(state);
  const byGroup = { needs: { budgeted: 0, spent: 0 }, wants: { budgeted: 0, spent: 0 }, save: { budgeted: 0, spent: 0 } };
  for (const c of state.categories) {
    byGroup[c.group].budgeted += c.budgeted;
    byGroup[c.group].spent += spent[c.id] || 0;
  }
  const budgeted = byGroup.needs.budgeted + byGroup.wants.budgeted + byGroup.save.budgeted;
  const spentTotal = byGroup.needs.spent + byGroup.wants.spent + byGroup.save.spent;
  const unassigned = state.income - budgeted;
  const over = Math.max(0, spentTotal - budgeted);
  const cashLeft = state.income - spentTotal;
  const unpaidBills = state.bills.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  const safeToSpend = cashLeft - unpaidBills;
  const overCats = state.categories
    .map((c) => ({ ...c, spent: spent[c.id] || 0 }))
    .filter((c) => c.spent > c.budgeted);
  return { spent, byGroup, budgeted, spentTotal, unassigned, over, cashLeft, unpaidBills, safeToSpend, overCats };
}

// --- Dasbor v2: ringkasan per bulan, aman per hari, self-check, aksi minggu ini. ---
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// "Hari ini" dihitung dalam WIB — tanggal-tanggal situs (transaksi,
// gajian) adalah tanggal Indonesia, dan pengunjungnya di Asia/Jakarta.
function todayWIB(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t) => Number(parts.find((x) => x.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

// Hari tersisa sampai gajian tanggal 1 bulan depan (dari tanggal "hari ini").
export function daysToPayday(state, now = new Date()) {
  const t = todayWIB(now);
  if (t.d === state.family.payday) return 0;
  const today = Date.UTC(t.y, t.m - 1, t.d);
  const ny = t.m === 12 ? t.y + 1 : t.y;
  const nm = t.m === 12 ? 1 : t.m + 1;
  const next = Date.UTC(ny, nm - 1, state.family.payday);
  return Math.max(0, Math.round((next - today) / 86400000));
}

export function paydayLabel(state, now = new Date()) {
  const t = todayWIB(now);
  if (t.d === state.family.payday) return `${state.family.payday} ${MONTH_SHORT[t.m - 1]}`;
  const nm = t.m === 12 ? 1 : t.m + 1;
  return `${state.family.payday} ${MONTH_SHORT[nm - 1]}`;
}

const MONTH_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Label gajian panjang ("1 Desember") — dipakai halaman Tagihan; dihitung
// dari tanggal, bukan ditulis tangan.
export function paydayLabelLong(state, now = new Date()) {
  const t = todayWIB(now);
  if (t.d === state.family.payday) return `${state.family.payday} ${MONTH_FULL[t.m - 1]}`;
  const nm = t.m === 12 ? 1 : t.m + 1;
  return `${state.family.payday} ${MONTH_FULL[nm - 1]}`;
}

export function safePerDay(state, now = new Date()) {
  const t = totals(state);
  const days = daysToPayday(state, now);
  return days <= 0 ? t.safeToSpend : Math.round(t.safeToSpend / days);
}

// Ringkasan satu bulan untuk pemilih bulan di dasbor. November = angka hidup
// dari transaksi; bulan lain = ringkasan dari history (needs/wants/save).
export function monthSummary(state, label) {
  if (!label || label === "Nov 2026") {
    const t = totals(state);
    return {
      label: "Nov 2026", spent: t.spentTotal, cashLeft: t.cashLeft,
      saveRate: Math.round((t.cashLeft / state.income) * 100),
      income: state.income,
      byGroup: {
        needs: { spent: t.byGroup.needs.spent },
        wants: { spent: t.byGroup.wants.spent },
        save: { spent: t.byGroup.save.spent },
      },
      unpaid: t.unpaidBills, overCats: t.overCats, live: true,
    };
  }
  const h = state.history.find((x) => x.month === label);
  if (!h || h.spent == null) return null;
  // Pemasukan per bulan: Juni–Oktober Rp 9.750.000 (jualan kue Ratna baru
  // mulai November, jadi ringkasan lama tidak boleh memakai income baru).
  const inc = h.income ?? state.income;
  return {
    label: h.month, spent: h.spent, cashLeft: inc - h.spent,
    saveRate: Math.round(((inc - h.spent) / inc) * 100),
    income: inc,
    byGroup: {
      needs: { spent: h.needs || 0 },
      wants: { spent: h.wants || 0 },
      save: { spent: h.save || 0 },
    },
    unpaid: h.unpaid ?? 0, overCats: [], live: false,
  };
}

// Strip self-check: semua dihitung dari state, tidak ada yang ditulis tangan.
export function selfChecks(state) {
  const t = totals(state);
  const known = new Set(state.categories.map((c) => c.id));
  const uncategorized = state.transactions.filter(([, , cat]) => !known.has(cat)).length;
  const sumSpent = Object.values(t.spent).reduce((s, v) => s + v, 0);
  const sumsMatch = sumSpent === t.spentTotal && t.cashLeft === state.income - t.spentTotal;
  const overAssigned = Math.max(0, t.budgeted - state.income);
  return { txCount: state.transactions.length, uncategorized, sumsMatch, overAssigned };
}

// Aksi minggu ini, diturunkan dari data: tagihan belum dibayar (urut tanggal)
// + amplop yang lewat anggaran + tujuan terdekat. Tiap aksi membawa satu
// baris alasan yang dihitung dari state (keterlambatan, persen anggaran,
// sisa aman dibelanjakan) — bukan ringkasan tanpa alasan.
export function weeklyActions(state, now = new Date()) {
  const t = totals(state);
  const out = [];
  const today = todayWIB(now);
  const pay = paydayLabel(state, now);
  const unpaid = [...state.bills].filter((b) => !b.paid).sort((a, b) => a.day - b.day);
  for (const b of unpaid) {
    const diff = b.day - today.d;
    const when = diff < 0 ? `Sudah lewat ${-diff} hari dari tgl ${b.day}.`
      : diff === 0 ? "Jatuh tempo hari ini."
      : diff === 1 ? "Jatuh tempo besok."
      : `Jatuh tempo dalam ${diff} hari.`;
    out.push({
      action: `Bayar ${b.name} ${rupiah(b.amount)} (tgl ${b.day}) — sebelum gajian ${pay}`,
      reason: when,
    });
  }
  for (const c of [...t.overCats].sort((a, b) => (b.spent - b.budgeted) - (a.spent - a.budgeted))) {
    const pct = Math.round((c.spent / c.budgeted) * 100);
    out.push({
      action: `Tutup kelebihan ${c.name} ${rupiah(c.spent - c.budgeted)} dari ${rupiah(t.unassigned)} yang belum dibagikan`,
      reason: `Sudah ${pct}% dari anggaran ${rupiah(c.budgeted)}.`,
    });
  }
  const nearest = [...state.goals]
    .map((g) => ({ ...g, left: g.target - g.saved }))
    .filter((g) => g.left > 0)
    .sort((a, b) => a.left - b.left)[0];
  if (nearest) {
    out.push({
      action: `Setor ${rupiah(nearest.monthly)} ke ${nearest.name} — tinggal ${rupiah(nearest.left)} lagi, tercapai ${monthsToGoal(nearest)} bulan lagi`,
      reason: `Paling dekat — tinggal ${rupiah(nearest.left)} lagi.`,
    });
  }
  return out.slice(0, 4);
}

// Tagihan 14 hari ke depan, dihitung dari tanggal WIB hari ini: tagihan
// bulan ini yang belum dibayar (termasuk yang sudah lewat tanggalnya) +
// tagihan bulan depan yang jatuh tempo dalam jendela. Tiap baris membawa
// hitung mundur hari (negatif = terlambat). Dipakai dasbor v3.
export function upcomingBills(state, now = new Date(), windowDays = 14) {
  const t = todayWIB(now);
  const todayUTC = Date.UTC(t.y, t.m - 1, t.d);
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (const b of state.bills) {
    if (b.day <= daysIn(t.y, t.m)) {
      const diff = Math.round((Date.UTC(t.y, t.m - 1, b.day) - todayUTC) / 86400000);
      if (diff >= 0) {
        if (!b.paid) out.push({ ...b, daysUntil: diff, status: diff === 0 ? "today" : "due" });
      } else if (!b.paid) {
        out.push({ ...b, daysUntil: diff, status: "overdue" });
      }
    }
    const ny = t.m === 12 ? t.y + 1 : t.y;
    const nm = t.m === 12 ? 1 : t.m + 1;
    if (b.day <= daysIn(ny, nm)) {
      const diff = Math.round((Date.UTC(ny, nm - 1, b.day) - todayUTC) / 86400000);
      out.push({ ...b, daysUntil: diff, status: "scheduled" });
    }
  }
  return out.filter((b) => b.daysUntil <= windowDays).sort((a, b) => a.daysUntil - b.daysUntil);
}

// Tagihan 1–15 Desember (bulan depan, jumlah sama, tanggal sama).
export function decemberBills(state) {
  return state.bills.filter((b) => b.day <= 15).reduce((s, b) => s + b.amount, 0);
}

// --- Aksi pengguna: semuanya mengubah data lalu menyimpan. ---
export function addTransaction(state, day, merchant, cat, amount) {
  state.transactions.push([day, merchant, cat, amount]);
  state.transactions.sort((a, b) => a[0] - b[0]);
  saveState(state);
  return state;
}

export function moveMoney(state, fromId, toId, amount) {
  const from = state.categories.find((c) => c.id === fromId);
  const to = state.categories.find((c) => c.id === toId);
  if (!from || !to || fromId === toId || amount <= 0) return false;
  const moved = Math.min(amount, from.budgeted);
  from.budgeted -= moved;
  to.budgeted += moved;
  saveState(state);
  return moved;
}

export function toggleBill(state, index) {
  const bill = state.bills[index];
  if (!bill) return false;
  bill.paid = !bill.paid;
  saveState(state);
  return true;
}

// --- Utang: simulasi pelunasan bulan demi bulan. ---
// Tiap bulan: bunga berjalan, bayar minimum semua utang, sisa uang
// (sampai Rp 1.000.000/bulan) dilempar ke utang pertama sesuai urutan.
// Snowball = saldo terkecil dulu; avalanche = bunga tertinggi dulu.
export function payoffSimulation(state, method) {
  const debts = state.debts.map((d) => ({ ...d }));
  debts.sort((a, b) => (method === "snowball" ? a.balance - b.balance : b.rate - a.rate));
  let months = 0;
  let interest = 0;
  const monthly = state.debtMonthly;
  while (debts.some((d) => d.balance > 0) && months < 600) {
    months += 1;
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const i = (d.balance * d.rate) / 12;
      d.balance += i;
      interest += i;
    }
    let budget = monthly;
    for (const d of debts) {
      if (d.balance <= 0 || budget <= 0) continue;
      const pay = Math.min(d.minPayment, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
    }
    for (const d of debts) {
      if (d.balance <= 0 || budget <= 0) continue;
      const pay = Math.min(d.balance, budget);
      d.balance -= pay;
      budget -= pay;
    }
  }
  return { months, interest: Math.round(interest), order: debts.map((d) => d.name) };
}

export function monthsToGoal(goal) {
  if (goal.monthly <= 0) return null;
  return Math.ceil((goal.target - goal.saved) / goal.monthly);
}

export function toCSV(state) {
  const lines = ["tanggal,penjual,kategori,jumlah_rp"];
  const names = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  for (const [day, merchant, cat, amount] of state.transactions) {
    const safe = '"' + String(merchant).replace(/"/g, '""') + '"';
    lines.push(`${day},${safe},"${names[cat] || cat}",${amount}`);
  }
  return lines.join("\n");
}
