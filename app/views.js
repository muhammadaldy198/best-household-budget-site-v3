// RumahHitung — tampilan: 7 halaman hash-route.
// Tiap halaman membaca angka yang sama dari state.js; tidak ada angka
// yang ditulis tangan di markup.

import { rupiah, totals, decemberBills, payoffSimulation, monthsToGoal, daysToPayday, paydayLabel, paydayLabelLong, safePerDay, monthSummary, selfChecks, weeklyActions, upcomingBills } from "./state.js";
import { donut, ring, bars, lineChart } from "./charts.js";

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const GROUP = {
  needs: { label: "Kebutuhan", tag: "needs", color: "#1f6b4a" },
  wants: { label: "Keinginan", tag: "wants", color: "#d98e2b" },
  save: { label: "Tabungan & Utang", tag: "save", color: "#2c5f7c" },
};

function catRow(c, spent) {
  const remaining = c.budgeted - spent;
  const pct = c.budgeted > 0 ? Math.round((spent / c.budgeted) * 100) : 0;
  const over = spent > c.budgeted;
  const barCls = over ? "red" : pct > 85 ? "amber" : "";
  return `<tr class="${over ? "over-row" : ""}">
    <td><strong>${esc(c.name)}</strong><br><span class="tag ${GROUP[c.group].tag}">${GROUP[c.group].label}</span></td>
    <td class="r num">${rupiah(c.budgeted)}</td>
    <td class="r num">${rupiah(spent)}</td>
    <td class="r num ${remaining < 0 ? "over" : ""}">${remaining < 0 ? "−" + rupiah(-remaining) : rupiah(remaining)}</td>
    <td><span class="bar-row"><span class="bar"><i class="${barCls}" style="width:${Math.min(100, pct)}%"></i></span><span class="pct">${pct}%</span></span></td>
  </tr>`;
}

function groupTable(state, t, group) {
  const cats = state.categories.filter((c) => c.group === group);
  const g = t.byGroup[group];
  const pct = group === "needs" ? 50 : group === "wants" ? 30 : 20;
  const rows = cats.map((c) => catRow(c, t.spent[c.id] || 0)).join("");
  return `<div class="card">
    <h2>${GROUP[group].label} — ${rupiah(g.spent)} dari ${rupiah(g.budgeted)}</h2>
    <p class="small muted">Target 50/30/20 untuk kelompok ini: ${pct}% dari pemasukan (${rupiah(Math.round((state.income * pct) / 100))}).</p>
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Amplop</th><th class="r">Dianggarkan</th><th class="r">Terpakai</th><th class="r">Sisa</th><th>Pakai</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total"><td>Total ${GROUP[group].label}</td><td class="r num">${rupiah(g.budgeted)}</td><td class="r num">${rupiah(g.spent)}</td><td class="r num">${rupiah(g.budgeted - g.spent)}</td><td></td></tr></tfoot>
    </table></div>
  </div>`;
}

// ---------------- Dasbor ----------------
export function dashboard(state, month = "Nov 2026") {
  const t = totals(state);
  const m = monthSummary(state, month) || monthSummary(state, "Nov 2026");
  const live = m.live;
  const checks = selfChecks(state);
  const actions = weeklyActions(state);
  const unpaid = state.bills.filter((b) => !b.paid);
  const top = [...state.categories]
    .map((c) => ({ ...c, spent: t.spent[c.id] || 0 }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  const parts = [
    { label: "Kebutuhan", value: m.byGroup.needs.spent, color: "#1f6b4a" },
    { label: "Keinginan", value: m.byGroup.wants.spent, color: "#d98e2b" },
    { label: "Tabungan", value: m.byGroup.save.spent, color: "#2c5f7c" },
  ];
  const alerts = t.overCats.map((c) =>
    `<p><strong class="over">${esc(c.name)} lewat ${rupiah(c.spent - c.budgeted)}</strong> — terpakai ${rupiah(c.spent)} dari anggaran ${rupiah(c.budgeted)}. Tutup dari ${rupiah(t.unassigned)} yang belum dibagikan, atau pindahkan dari amplop lain di halaman Anggaran.</p>`).join("");
  const slack = t.budgeted - t.spentTotal;
  const perDay = safePerDay(state);
  const days = daysToPayday(state);
  const payLabel = paydayLabel(state);
  const needsPct = Math.round((m.byGroup.needs.spent / m.spent) * 100);
  const kpi1 = live
    ? { label: "Siap Dibagikan", big: rupiah(t.cashLeft), sub: `${rupiah(t.unassigned)} belum dianggarkan ${slack >= 0 ? `&middot; terpakai ${rupiah(t.spentTotal)} dari anggaran ${rupiah(t.budgeted)}` : `&minus; ${rupiah(-slack)} kelebihan belanja`}` }
    : { label: "Sisa kas Oktober", big: rupiah(m.cashLeft), sub: `Pemasukan ${rupiah(m.income)} &minus; terpakai ${rupiah(m.spent)}` };
  const kpi2 = live
    ? { label: "Aman Dibelanjakan", big: rupiah(t.safeToSpend), sub: `${rupiah(perDay)}/hari sampai gajian ${payLabel} (${days} hari lagi)` }
    : { label: "Aman Dibelanjakan", big: rupiah(m.cashLeft - m.unpaid), sub: "Semua tagihan Oktober lunas &middot; Rp 0 belum dibayar" };
  const kpi3 = { label: live ? "Terpakai bulan ini" : "Terpakai Oktober", big: rupiah(m.spent), sub: `dari pemasukan ${rupiah(m.income)} &middot; ${Math.round((m.spent / m.income) * 100)}%` };
  const kpi4 = live
    ? { label: "Amplop lewat anggaran", big: `${t.overCats.length} amplop`, sub: t.overCats.map((c) => esc(c.name)).join(", ") || "Tidak ada — semua amplop aman", alert: t.overCats.length > 0 }
    : { label: "Tingkat tabungan", big: `${m.saveRate}%`, sub: `Sisa kas ${rupiah(m.cashLeft)} dari ${rupiah(state.income)}`, alert: false };
  const lede = live
    ? `November 2026 &middot; ${state.transactions.length} transaksi &middot; ${state.categories.length} amplop &middot; ${state.bills.length} tagihan &middot; ${state.goals.length} tujuan &middot; ${state.debts.length} utang. Pemasukan ${rupiah(state.income)} (gaji + jualan kue Ratna). Setiap rupiah di bawah ini dihitung dari transaksi.`
    : `Oktober 2026 &middot; terpakai ${rupiah(m.spent)} dari ${rupiah(m.income)} &middot; sisa kas ${rupiah(m.cashLeft)} &middot; ringkasan dari riwayat 6 bulan. Beralih ke November untuk angka hidup yang dihitung dari transaksi.`;
  const todo = live
    ? `<div class="card todo-card">
      <h2>Lakukan minggu ini</h2>
      <ol class="todo-grid">${actions.map((a) => `<li><span class="act">${esc(a.action)}</span><span class="why">${esc(a.reason)}</span></li>`).join("")}</ol>
    </div>`
    : `<div class="card todo-card">
      <h2>Oktober sudah ditutup</h2>
      <p style="margin:0">Terpakai ${rupiah(m.spent)}, sisa kas ${rupiah(m.cashLeft)} (${m.saveRate}% ditabung), semua tagihan lunas. November sedang berjalan — lihat aksinya di atas.</p>
    </div>`;
  // Tagihan 14 hari ke depan — daftar hitung mundur (v3): tagihan yang
  // belum dibayar bulan ini + tagihan bulan depan dalam jendela 14 hari.
  const next14 = live ? upcomingBills(state) : [];
  const next14Total = next14.reduce((s, b) => s + b.amount, 0);
  const chip = (b) => b.status === "overdue"
    ? `<span class="chip overdue">terlambat ${-b.daysUntil} hari</span>`
    : b.status === "today" ? `<span class="chip due">hari ini</span>`
    : b.daysUntil === 1 ? `<span class="chip due">besok</span>`
    : b.status === "due" ? `<span class="chip due">dalam ${b.daysUntil} hari</span>`
    : `<span class="chip sched">dalam ${b.daysUntil} hari</span>`;
  const bills14 = live
    ? `<div class="card">
      <h2>Tagihan 14 hari ke depan</h2>
      <ul class="bills14">${next14.map((b) => `<li><span class="b14-name">${esc(b.name)}</span><span class="b14-amt num">${rupiah(b.amount)}</span>${chip(b)}</li>`).join("")}</ul>
      <p class="small" style="margin:10px 0 0">${next14.length} tagihan &middot; total <strong>${rupiah(next14Total)}</strong> &middot; <a href="#/tagihan">Lihat semua tagihan</a></p>
    </div>`
    : "";
  return `
  <div class="page-head">
    <div>
      <h1>Dasbor Keluarga Santoso</h1>
      <p class="lede">${lede}</p>
    </div>
    <div class="month-switch" role="group" aria-label="Pilih bulan">
      <span class="small muted">Bulan:</span>
      <button type="button" data-month="Okt 2026" aria-pressed="${!live}">Okt 2026</button>
      <button type="button" data-month="Nov 2026" aria-pressed="${live}">Nov 2026</button>
    </div>
  </div>
  <p class="checks" role="status">&check; ${checks.txCount} transaksi &nbsp;&middot;&nbsp; &check; ${checks.uncategorized} tanpa amplop &nbsp;&middot;&nbsp; &check; ${checks.sumsMatch ? "angka cocok ke rupiah" : "angka TIDAK cocok"} &nbsp;&middot;&nbsp; &check; ${rupiah(checks.overAssigned)} belum dibagikan berlebih</p>
  <div class="grid grid-4" style="margin-bottom:16px">
    <div class="card stat hero"><div class="label">${kpi1.label}</div><div class="big money">${kpi1.big}</div><div class="sub">${kpi1.sub}</div></div>
    <div class="card stat"><div class="label">${kpi2.label}</div><div class="big money">${kpi2.big}</div><div class="sub">${kpi2.sub}</div></div>
    <div class="card stat"><div class="label">${kpi3.label}</div><div class="big money">${kpi3.big}</div><div class="sub">${kpi3.sub}</div></div>
    <div class="card stat ${kpi4.alert ? "alert" : ""}"><div class="label">${kpi4.label}</div><div class="big money">${kpi4.big}</div><div class="sub">${kpi4.sub}</div></div>
  </div>
  ${todo}
  <div class="grid grid-hero3" style="margin-top:16px">
    <div class="card">
      <h2>Ke mana uang pergi — ${m.label}</h2>
      <div class="donut-wrap">
        ${donut(parts, 170)}
        <ul class="legend">
          <li><span class="sw" style="background:#1f6b4a"></span>Kebutuhan <b>${rupiah(m.byGroup.needs.spent)} &middot; ${Math.round((m.byGroup.needs.spent / m.spent) * 100)}%</b></li>
          <li><span class="sw" style="background:#d98e2b"></span>Keinginan <b>${rupiah(m.byGroup.wants.spent)} &middot; ${Math.round((m.byGroup.wants.spent / m.spent) * 100)}%</b></li>
          <li><span class="sw" style="background:#2c5f7c"></span>Tabungan &amp; utang <b>${rupiah(m.byGroup.save.spent)} &middot; ${Math.round((m.byGroup.save.spent / m.spent) * 100)}%</b></li>
        </ul>
      </div>
      <div class="rule"></div>
      <p class="small">Aturan 50/30/20 menargetkan kebutuhan 50%, keinginan 30%, tabungan 20%. ${m.label === "Nov 2026" ? "Bulan ini" : "Bulan itu"} kebutuhan ${needsPct}% — lihat <a href="#/kalkulator">Kalkulator 50/30/20</a> untuk perbandingannya.</p>
    </div>
    <div class="card">
      <h2>Perlu perhatian</h2>
      ${alerts || '<p class="small">Tidak ada amplop yang lewat anggaran bulan ini.</p>'}
      <p><strong>${unpaid.length} tagihan belum dibayar:</strong> ${unpaid.map((b) => `${esc(b.name)} ${rupiah(b.amount)} (tgl ${b.day})`).join(", ")}. <a href="#/tagihan">Lihat Tagihan</a></p>
      <div class="rule"></div>
      <h3>Keluarga</h3>
      <dl class="kv">
        ${state.family.members.map((m) => `<dt>${esc(m.name)} — ${esc(m.role)}</dt><dd>${m.income ? rupiah(m.income) + "/bln" : "—"}</dd>`).join("")}
      </dl>
    </div>
    ${bills14}
  </div>
  <div class="card" style="margin-top:16px">
    <h2>5 amplop terbesar November</h2>
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Amplop</th><th class="r">Dianggarkan</th><th class="r">Terpakai</th><th class="r">Sisa</th><th>Pakai</th></tr></thead>
      <tbody>${top.map((c) => catRow(c, c.spent)).join("")}</tbody>
    </table></div>
    <p class="small" style="margin-top:12px"><a href="#/anggaran">Lihat semua ${state.categories.length} amplop &rarr;</a> &nbsp; <a href="#/transaksi">Lihat semua ${state.transactions.length} transaksi &rarr;</a></p>
  </div>`;
}

// ---------------- Anggaran ----------------
export function budget(state, moveMsg = "") {
  const t = totals(state);
  const optsFor = (selectedId) => state.categories.map((c) => `<option value="${c.id}"${c.id === selectedId ? " selected" : ""}>${esc(c.name)} — ${rupiah(c.budgeted)}</option>`).join("");
  const optsFrom = optsFor("sewa");
  const optsTo = optsFor("makan");
  return `
  <div class="page-head"><div>
    <h1>Anggaran — 18 amplop</h1>
    <p class="lede">Rp ${t.budgeted.toLocaleString("id-ID")} sudah dibagikan dari Rp ${state.income.toLocaleString("id-ID")} pemasukan. Sisa yang belum dibagikan: <strong>${rupiah(t.unassigned)}</strong>. Pindah uang antar amplop benar-benar mengubah anggarannya.</p>
  </div></div>
  <div class="card" style="margin-bottom:16px">
    <h2>Pindah uang antar amplop</h2>
    <p class="small muted">Aturan ketiga YNAB: kalau satu amplop jebol, pindahkan dari amplop lain — jangan pura-pura tidak terjadi.</p>
    <form class="inline-form" id="move-form">
      <div class="row">
        <label class="field">Dari amplop<select name="from">${optsFrom}</select></label>
        <label class="field">Ke amplop<select name="to">${optsTo}</select></label>
        <label class="field">Jumlah (Rp)<input name="amount" type="number" min="1000" step="1000" value="150000" required></label>
        <label class="field">&nbsp;<button class="btn" type="submit">Pindahkan</button></label>
      </div>
    </form>
    ${moveMsg ? `<p class="note green" role="status">${moveMsg}</p>` : ""}
  </div>
  <div class="grid" style="gap:16px">
    ${groupTable(state, t, "needs")}
    ${groupTable(state, t, "wants")}
    ${groupTable(state, t, "save")}
  </div>`;
}

// ---------------- Transaksi ----------------
export function transactions(state, filter = { q: "", cat: "all" }, addedMsg = "") {
  const t = totals(state);
  const names = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const groups = Object.fromEntries(state.categories.map((c) => [c.id, c.group]));
  let list = state.transactions.map(([day, merchant, cat, amount], i) => ({ day, merchant, cat, amount, i }));
  if (filter.cat !== "all") list = list.filter((x) => x.cat === filter.cat);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((x) => x.merchant.toLowerCase().includes(q) || (names[x.cat] || "").toLowerCase().includes(q));
  }
  const shown = list.reduce((s, x) => s + x.amount, 0);
  const pills = [`<button type="button" data-cat="all" aria-pressed="${filter.cat === "all"}">Semua</button>`]
    .concat(state.categories.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${filter.cat === c.id}">${esc(c.name)}</button>`))
    .join("");
  const rows = list.map((x) => `<tr>
    <td class="num">${x.day} Nov</td>
    <td><strong>${esc(x.merchant)}</strong></td>
    <td><span class="tag ${GROUP[groups[x.cat]].tag}">${esc(names[x.cat])}</span></td>
    <td class="r num">${rupiah(x.amount)}</td>
  </tr>`).join("");
  const catOpts = state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  return `
  <div class="page-head"><div>
    <h1>Transaksi — ${state.transactions.length} transaksi</h1>
    <p class="lede">Total terpakai ${rupiah(t.spentTotal)}. Tambah transaksi di bawah — dasbor dan anggaran ikut berubah karena semuanya dihitung dari daftar ini.</p>
  </div></div>
  <div class="card" style="margin-bottom:16px">
    <h2>Tambah transaksi</h2>
    <form class="inline-form" id="add-form">
      <div class="row">
        <label class="field">Tanggal (1–30)<input name="day" type="number" min="1" max="30" value="27" required></label>
        <label class="field">Keterangan<input name="merchant" type="text" maxlength="80" placeholder="cth. Sayur pasar pagi" required></label>
        <label class="field">Amplop<select name="cat">${catOpts}</select></label>
        <label class="field">Jumlah (Rp)<input name="amount" type="number" min="100" step="100" value="25000" required></label>
      </div>
      <div><button class="btn" type="submit">Simpan transaksi</button></div>
    </form>
    ${addedMsg ? `<p class="note green" role="status">${addedMsg}</p>` : ""}
  </div>
  <div class="card">
    <div class="search-row">
      <input type="search" id="tx-search" placeholder="Cari penjual atau amplop…" value="${esc(filter.q)}" aria-label="Cari transaksi">
      <span class="small muted">${list.length} transaksi &middot; ${rupiah(shown)}</span>
    </div>
    <ul class="pill-list" id="tx-filter">${pills}</ul>
    <div class="table-scroll" style="margin-top:12px"><table class="ledger">
      <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Amplop</th><th class="r">Jumlah</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Tidak ada transaksi yang cocok. Ubah pencarian atau filter.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}

// ---------------- Tagihan ----------------
export function bills(state) {
  const t = totals(state);
  const dec = decemberBills(state);
  const paid = state.bills.filter((b) => b.paid).length;
  const payLong = paydayLabelLong(state);
  const earners = state.family.members.filter((m) => m.income > 0)
    .map((m) => `${esc(m.name.split(" ")[0])} ${rupiah(m.income)}`).join(" + ");
  const rows = state.bills.map((b, i) => `<tr class="${!b.paid ? "over-row" : ""}">
    <td><strong>${esc(b.name)}</strong><br><span class="small muted">${esc(b.note)}</span></td>
    <td class="r num">tgl ${b.day}</td>
    <td class="r num">${rupiah(b.amount)}</td>
    <td><span class="tag ${b.paid ? "paid" : "due"}">${b.paid ? "Lunas" : "Belum dibayar"}</span></td>
    <td><button class="btn ghost small" type="button" data-bill="${i}">${b.paid ? "Batalkan lunas" : "Tandai lunas"}</button></td>
  </tr>`).join("");
  return `
  <div class="page-head"><div>
    <h1>Tagihan — 14 tagihan</h1>
    <p class="lede">${paid} lunas, ${state.bills.length - paid} belum dibayar. Menandai lunas benar-benar mengubah angka "Aman Dibelanjakan" di dasbor.</p>
  </div></div>
  <div class="grid grid-2" style="margin-bottom:16px">
    <div class="card stat hero">
      <div class="label">Gajian ${payLong}</div>
      <div class="big money">${rupiah(state.income)}</div>
      <div class="sub">${earners} &middot; masuk tanggal 1 setiap bulan</div>
    </div>
    <div class="card stat">
      <div class="label">Tagihan 1–15 Desember</div>
      <div class="big money">${rupiah(dec)}</div>
      <div class="sub">Sisa setelah tagihan: <strong>${rupiah(state.income - dec)}</strong> untuk 16–31 Desember</div>
    </div>
  </div>
  <div class="card">
    <h2>Kalender tagihan November</h2>
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Tagihan</th><th class="r">Jatuh tempo</th><th class="r">Jumlah</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total"><td>Total tagihan bulan ini</td><td></td><td class="r num">${rupiah(state.bills.reduce((s, b) => s + b.amount, 0))}</td><td></td><td></td></tr></tfoot>
    </table></div>
    <p class="small" style="margin-top:12px">Belum dibayar sebelum gajian ${payLong}: <strong class="over">${rupiah(t.unpaidBills)}</strong> — sudah dikurangkan dari "Aman Dibelanjakan" (${rupiah(t.safeToSpend)}).</p>
  </div>`;
}

// ---------------- Tujuan & Utang ----------------
export function goals(state) {
  const goalCards = state.goals.map((g) => {
    const pct = Math.round((g.saved / g.target) * 100);
    const months = monthsToGoal(g);
    return `<div class="card"><div class="goal-ring">
      ${ring(pct)}
      <div><h3>${esc(g.name)}</h3>
      <p class="small">${esc(g.note)}</p>
      <dl class="kv">
        <dt>Terkumpul</dt><dd>${rupiah(g.saved)} dari ${rupiah(g.target)}</dd>
        <dt>Setoran/bulan</dt><dd>${rupiah(g.monthly)}</dd>
        <dt>Tercapai dalam</dt><dd>${months === null ? "—" : months + " bulan"}</dd>
      </dl></div>
    </div></div>`;
  }).join("");
  const snow = payoffSimulation(state, "snowball");
  const aval = payoffSimulation(state, "avalanche");
  const saved = snow.interest - aval.interest;
  const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0);
  const minSum = state.debts.reduce((s, d) => s + d.minPayment, 0);
  const goalTarget = state.goals.reduce((s, g) => s + g.target, 0);
  const goalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
  const debtRows = state.debts.map((d) => `<tr>
    <td><strong>${esc(d.name)}</strong><br><span class="small muted">${esc(d.note)}</span></td>
    <td class="r num">${rupiah(d.balance)}</td>
    <td class="r num">${Math.round(d.rate * 100)}%</td>
    <td class="r num">${rupiah(d.minPayment)}/bln</td>
  </tr>`).join("");
  return `
  <div class="page-head"><div>
    <h1>Tujuan &amp; Utang</h1>
    <p class="lede">${state.goals.length} tujuan tabungan — total target ${rupiah(goalTarget)}, sudah terkumpul ${rupiah(goalSaved)} — dan ${state.debts.length} utang senilai ${rupiah(totalDebt)} yang dilunasi ${rupiah(state.debtMonthly)}/bulan.</p>
  </div></div>
  <h2 style="margin-bottom:12px">Utang — snowball lawan avalanche</h2>
  <div class="card" style="margin-bottom:16px">
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Utang</th><th class="r">Saldo</th><th class="r">Bunga</th><th class="r">Minimum</th></tr></thead>
      <tbody>${debtRows}</tbody>
      <tfoot><tr class="total"><td>Total utang</td><td class="r num">${rupiah(totalDebt)}</td><td></td><td class="r num">${rupiah(minSum)}/bln + ${rupiah(state.debtMonthly - minSum)} extra</td></tr></tfoot>
    </table></div>
  </div>
  <div class="grid grid-2" style="margin-bottom:20px">
    <div class="card">
      <h3>Snowball — saldo terkecil dulu</h3>
      <p class="small muted">Urutan: ${snow.order.join(" → ")}.</p>
      <dl class="kv"><dt>Bebas utang dalam</dt><dd>${snow.months} bulan</dd><dt>Total bunga dibayar</dt><dd>${rupiah(snow.interest)}</dd></dl>
      <p class="small">Menang cepat di awal — tiap utang lunas memberi semangat lanjut.</p>
    </div>
    <div class="card">
      <h3>Avalanche — bunga tertinggi dulu</h3>
      <p class="small muted">Urutan: ${aval.order.join(" → ")}.</p>
      <dl class="kv"><dt>Bebas utang dalam</dt><dd>${aval.months} bulan</dd><dt>Total bunga dibayar</dt><dd>${rupiah(aval.interest)}</dd></dl>
      <p class="small"><strong class="good">Hemat ${rupiah(saved)} bunga</strong> dibanding snowball, dalam waktu yang sama (${aval.months} bulan). Untuk keluarga ini, avalanche lebih murah.</p>
    </div>
  </div>
  <h2 style="margin-bottom:12px">Tujuan tabungan</h2>
  <div class="grid grid-2" style="margin-bottom:20px">${goalCards}</div>`;
}

// ---------------- Kalkulator 50/30/20 ----------------
export function calculator(state, income = null, split = null) {
  const t = totals(state);
  const inc = income ?? state.income;
  const sp = split ?? { needs: 50, wants: 30, save: 20 };
  const target = {
    needs: Math.round((inc * sp.needs) / 100),
    wants: Math.round((inc * sp.wants) / 100),
    save: Math.round((inc * sp.save) / 100),
  };
  const actual = {
    needs: t.byGroup.needs.budgeted,
    wants: t.byGroup.wants.budgeted,
    save: t.byGroup.save.budgeted,
  };
  const sewaB = state.categories.find((c) => c.id === "sewa").budgeted;
  const sekolahB = state.categories.find((c) => c.id === "sekolah").budgeted;
  const row = (key, label) => {
    const diff = actual[key] - target[key];
    return `<tr>
      <td><strong>${label}</strong><br><span class="small muted">${sp[key]}% dari pemasukan</span></td>
      <td class="r num">${rupiah(target[key])}</td>
      <td class="r num">${rupiah(actual[key])}</td>
      <td class="r num ${diff > 0 ? "over" : "good"}">${diff > 0 ? "+" + rupiah(diff) : diff < 0 ? "−" + rupiah(-diff) : "Pas"}</td>
    </tr>`;
  };
  return `
  <div class="page-head"><div>
    <h1>Kalkulator 50/30/20</h1>
    <p class="lede">Aturan Warren &amp; Tyagi: 50% kebutuhan, 30% keinginan, 20% tabungan + pelunasan utang. Ubah pemasukan atau pembagiannya — target dan perbandingan dengan anggaran nyata Keluarga Santoso ikut berubah.</p>
  </div></div>
  <div class="grid grid-hero" style="margin-bottom:16px">
    <div class="card">
      <h2>Atur angkamu</h2>
      <form class="inline-form" id="calc-form">
        <div class="row">
          <label class="field">Pemasukan/bulan (Rp)<input name="income" type="number" min="1000000" step="50000" value="${inc}"></label>
          <label class="field">Kebutuhan (%)<input name="needs" type="number" min="0" max="100" value="${sp.needs}"></label>
          <label class="field">Keinginan (%)<input name="wants" type="number" min="0" max="100" value="${sp.wants}"></label>
          <label class="field">Tabungan (%)<input name="save" type="number" min="0" max="100" value="${sp.save}"></label>
        </div>
        <div><button class="btn" type="submit">Hitung ulang</button>
        <button class="btn ghost" type="button" id="calc-503020">Pakai 50/30/20</button></div>
      </form>
      <p class="small muted" id="calc-note">Ketiga persen harus berjumlah 100.</p>
    </div>
    <div class="card">
      <h2>Yang sering salah digolongkan</h2>
      <p class="small"><strong>Keinginan, bukan kebutuhan:</strong> makan di luar, langganan streaming, gym, kopi kekinian, liburan, upgrade HP. Di keluarga ini ketiganya menelan ${rupiah(t.spent.makan || 0)} + ${rupiah(t.spent.hiburan || 0)} + ${rupiah(t.spent.jajan || 0)} bulan ini.</p>
      <p class="small"><strong>Kebutuhan:</strong> sewa, listrik, air, belanja harian, transport kerja/sekolah, SPP, BPJS, obat.</p>
      <p class="small"><strong>Tabungan:</strong> dana darurat, DP rumah, investasi, dan pelunasan utang di atas minimum.</p>
    </div>
  </div>
  <div class="card">
    <h2>Target lawan anggaran nyata keluarga ini</h2>
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Kelompok</th><th class="r">Target</th><th class="r">Anggaran nyata</th><th class="r">Selisih</th></tr></thead>
      <tbody>
        ${row("needs", "Kebutuhan")}
        ${row("wants", "Keinginan")}
        ${row("save", "Tabungan & utang")}
      </tbody>
      <tfoot><tr class="total"><td>Total</td><td class="r num">${rupiah(target.needs + target.wants + target.save)}</td><td class="r num">${rupiah(actual.needs + actual.wants + actual.save)}</td><td></td></tr></tfoot>
    </table></div>
    <div class="note" style="margin-top:14px"><strong>Bacaannya (pembagian ${sp.needs}/${sp.wants}/${sp.save}):</strong> kebutuhan keluarga ini ${actual.needs >= target.needs ? rupiah(actual.needs - target.needs) + " di atas target " + sp.needs + "%" : rupiah(target.needs - actual.needs) + " di bawah target " + sp.needs + "%"} — sewa ${rupiah(sewaB)} dan sekolah ${rupiah(sekolahB)} yang mendorongnya. Keinginan ${actual.wants <= target.wants ? rupiah(target.wants - actual.wants) + " di bawah target karena liburan dicatat sebagai tabungan" : rupiah(actual.wants - target.wants) + " di atas target"}. Kalau ${rupiah(t.unassigned)} yang belum dibagikan masuk tabungan, tabungan naik jadi ${rupiah(actual.save + t.unassigned)} (${Math.round(((actual.save + t.unassigned) / state.income) * 100)}% dari pemasukan).</div>
  </div>`;
}

// ---------------- Laporan ----------------
export function report(state) {
  const t = totals(state);
  const hist = state.history.map((h) => ({ ...h, spent: h.spent ?? t.spentTotal, income: h.income ?? state.income }));
  const rows = hist.map((h) => ({ label: h.month.split(" ")[0], a: h.spent, b: h.income }));
  const savings = hist.map((h) => ({ label: h.month.split(" ")[0], value: h.income - h.spent }));
  const rate = Math.round((t.cashLeft / state.income) * 100);
  const oct = state.history.find((h) => h.month === "Okt 2026");
  const octSpent = oct ? oct.spent : 0;
  const octIncome = oct && oct.income ? oct.income : state.income;
  const makan = state.categories.find((c) => c.id === "makan");
  const makanSpent = t.spent.makan || 0;
  const makanOver = makanSpent - makan.budgeted;
  const jajan = state.categories.find((c) => c.id === "jajan");
  const jajanSpent = t.spent.jajan || 0;
  const jajanOver = jajanSpent - jajan.budgeted;
  const top = [...state.categories]
    .map((c) => ({ ...c, spent: t.spent[c.id] || 0 }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  return `
  <div class="page-head"><div>
    <h1>Laporan — 6 bulan terakhir</h1>
    <p class="lede">Juni–November 2026. Juni–Oktober pemasukan ${rupiah(octIncome)}/bulan; November naik jadi ${rupiah(state.income)} karena jualan kue Ratna. Yang bergerak adalah pengeluaran — November bulan paling boros, penyebabnya kelihatan di bawah.</p>
  </div></div>
  <div class="grid grid-3" style="margin-bottom:16px">
    <div class="card stat"><div class="label">Rata-rata terpakai/bulan</div><div class="big money">${rupiah(Math.round(hist.reduce((s, h) => s + h.spent, 0) / 6))}</div><div class="sub">6 bulan, Juni–November</div></div>
    <div class="card stat"><div class="label">Tingkat tabungan November</div><div class="big money">${rate}%</div><div class="sub">Sisa kas ${rupiah(t.cashLeft)} dari ${rupiah(state.income)}</div></div>
    <div class="card stat alert"><div class="label">Bulan paling boros</div><div class="big money">November</div><div class="sub">${rupiah(t.spentTotal)} — ${rupiah(t.spentTotal - octSpent)} di atas Oktober</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <h2>Pemasukan lawan pengeluaran</h2>
      <p class="small muted">Hijau = terpakai, krem = pemasukan (Juni–Okt ${rupiah(octIncome)}; November ${rupiah(state.income)}).</p>
      ${bars(rows)}
    </div>
    <div class="card">
      <h2>Sisa yang ditabung tiap bulan</h2>
      <p class="small muted">November turun karena pengeluaran naik di hampir semua amplop.</p>
      ${lineChart(savings)}
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <h2>5 amplop terbesar November</h2>
    <div class="table-scroll"><table class="ledger">
      <thead><tr><th>Amplop</th><th class="r">Dianggarkan</th><th class="r">Terpakai</th><th class="r">Sisa</th><th>Pakai</th></tr></thead>
      <tbody>${top.map((c) => catRow(c, c.spent)).join("")}</tbody>
    </table></div>
    <p class="small" style="margin-top:12px"><strong>Kesimpulan:</strong> Makan di Luar ${rupiah(makanSpent)} adalah amplop yang paling jebol (+${rupiah(makanOver)} dari anggaran ${rupiah(makan.budgeted)}), dan Jajan &amp; Kopi juga lewat ${rupiah(jajanOver)}. Masak 3 kali seminggu lagi mengembalikan ${rupiah(makanOver)} itu ke tabungan.</p>
  </div>`;
}
