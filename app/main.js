// RumahHitung — router hash + pengikat aksi.
// Rute: #/ dasbor, #/anggaran, #/transaksi, #/tagihan, #/tujuan,
// #/kalkulator, #/laporan. Semua aksi (tambah transaksi, pindah uang,
// tandai lunas, kalkulator) menulis ke state lalu me-render ulang.

import { loadState, saveState, resetState, addTransaction, moveMoney, toggleBill, rupiah, toCSV } from "./state.js";
import { dashboard, budget, transactions, bills, goals, calculator, report, esc } from "./views.js";

let state = loadState();
let txFilter = { q: "", cat: "all" };
let calcIncome = null;
let calcSplit = null;
let dashMonth = "Nov 2026";
let moveMsg = "";
let addedMsg = "";

const app = document.getElementById("app");

function render() {
  const hash = location.hash || "#/";
  const route = hash.replace(/^#\/?/, "").split("/")[0];
  document.querySelectorAll(".topnav a").forEach((a) => {
    a.classList.toggle("active", (a.dataset.route || "") === route);
  });
  let html = "";
  if (route === "anggaran") html = budget(state, moveMsg);
  else if (route === "transaksi") html = transactions(state, txFilter, addedMsg);
  else if (route === "tagihan") html = bills(state);
  else if (route === "tujuan") html = goals(state);
  else if (route === "kalkulator") html = calculator(state, calcIncome, calcSplit);
  else if (route === "laporan") html = report(state);
  else html = dashboard(state, dashMonth);
  app.innerHTML = html;
  moveMsg = "";
  addedMsg = "";
  bind(route);
  window.scrollTo(0, 0);
}

function bind(route) {
  if (route === "") {
    app.querySelectorAll("button[data-month]").forEach((btn) => {
      btn.addEventListener("click", () => {
        dashMonth = btn.dataset.month;
        render();
      });
    });
  }
  if (route === "anggaran") {
    const form = document.getElementById("move-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const moved = moveMoney(state, data.get("from"), data.get("to"), Number(data.get("amount")));
      const fromName = state.categories.find((c) => c.id === data.get("from")).name;
      const toName = state.categories.find((c) => c.id === data.get("to")).name;
      moveMsg = moved
        ? `Berhasil: ${rupiah(moved)} dipindahkan dari ${esc(fromName)} ke ${esc(toName)}. Anggaran di bawah sudah berubah.`
        : "Tidak bisa memindahkan — periksa amplop dan jumlahnya.";
      render();
    });
  }
  if (route === "transaksi") {
    const form = document.getElementById("add-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      addTransaction(state, Number(data.get("day")), String(data.get("merchant")).trim(), data.get("cat"), Number(data.get("amount")));
      const catName = state.categories.find((c) => c.id === data.get("cat")).name;
      addedMsg = `Tersimpan: ${esc(String(data.get("merchant")).trim())} — ${rupiah(Number(data.get("amount")))} ke ${esc(catName)}. Total transaksi sekarang ${state.transactions.length}.`;
      render();
    });
    const search = document.getElementById("tx-search");
    search.addEventListener("input", () => {
      txFilter.q = search.value;
      const pos = search.selectionStart;
      render();
      const again = document.getElementById("tx-search");
      again.focus();
      again.setSelectionRange(pos, pos);
    });
    document.getElementById("tx-filter").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn) return;
      txFilter.cat = btn.dataset.cat;
      render();
    });
  }
  if (route === "tagihan") {
    app.querySelectorAll("button[data-bill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleBill(state, Number(btn.dataset.bill));
        render();
      });
    });
  }
  if (route === "kalkulator") {
    const form = document.getElementById("calc-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const n = Number(data.get("needs"));
      const w = Number(data.get("wants"));
      const s = Number(data.get("save"));
      const note = document.getElementById("calc-note");
      if (n + w + s !== 100) {
        note.textContent = `Jumlahnya ${n + w + s}, bukan 100 — perbaiki dulu pembagiannya.`;
        note.style.color = "#b3402a";
        return;
      }
      calcIncome = Number(data.get("income"));
      calcSplit = { needs: n, wants: w, save: s };
      render();
    });
    document.getElementById("calc-503020").addEventListener("click", () => {
      calcIncome = null;
      calcSplit = null;
      render();
    });
  }
}

document.getElementById("reset-demo").addEventListener("click", () => {
  state = resetState();
  txFilter = { q: "", cat: "all" };
  calcIncome = null;
  calcSplit = null;
  dashMonth = "Nov 2026";
  render();
});

document.getElementById("export-csv").addEventListener("click", () => {
  const blob = new Blob([toCSV(state)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rumahhitung-transaksi-november-2026.csv";
  a.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("hashchange", render);
render();
