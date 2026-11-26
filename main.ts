// RumahHitung — program penyerahan (Node 22, pustaka standar saja).
//
// v2 (27 Nov 2026): rebuild terarah dari v1 — set screenshot baru (dasbor,
// anggaran, tujuan+sim, laporan), dasbor v2 (aman per hari, self-check,
// lakukan minggu ini, pemilih bulan Okt/Nov); situs dan angka tidak berubah.
//
// v3 (27 Nov 2026): rebuild terarah dari v2 — volume 96 -> 172 transaksi
// November yang realistis (semua >= Rp 10.000, tanpa pengisi), dasbor
// tambah "Tagihan 14 hari ke depan" (9 tagihan, hitung mundur dari WIB),
// tiap aksi "Lakukan minggu ini" membawa satu baris alasan, hardcode
// "1 Des" diganti paydayLabel, angka yang dulu ditulis tangan (pemasukan,
// belum dibagikan, gaji) kini dihitung dari state. Pemasukan November
// naik ke Rp 11.750.000 karena jualan kue Ratna mulai bulan ini;
// ringkasan Oktober tetap Rp 9.750.000 lewat income per bulan di history.
// Model sim, struktur 7 file, dan identitas buku kas tidak berubah.
//
// Situsnya adalah folder app/ di sebelah file ini: file statis polos yang
// dibuka peramban di app/index.html (modul ES + CSS, tanpa build step),
// seluruh isinya dari file sendiri — tidak ada yang dimuat dari jaringan.
// Program ini menyerahkan situs itu: menyalin app/ dan screenshots/ ke
// /output lalu menulis /output/dossier.json, ringkasan yang dibaca juri
// (screenshot, file dan byte saat first load, dan sumbernya), memakai
// library make.fun yang di-vendor. Jangan ubah vendor/makefun-frontend.ts:
// scorer menuntut dossier.json byte demi byte sama dengan yang ditulis
// salinannya sendiri.
//
// Determinisme: penyalinan ini penyalinan file polos dan buildDossier
// itu murni, jadi dua kali jalan menulis byte yang sama persis.
// Di luar container grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(here, 'app', 'index.html'))) {
  throw new Error('app/index.html tidak ditemukan di sebelah main.ts — jalankan dari root repo entry.');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Batas scorer (reference/gate.json): hanya text_max_bytes yang membentuk
// byte dossier; sisanya menolak entry yang akan ditolak scorer (lebih dari
// 4 screenshot atau satu di atas 256 KiB; lebih dari 993 file dan direktori
// di app/ atau 16 MiB file app/: app/ dihitung bersama batas 1000 entri
// /output sendiri, screenshots/ dan dossier.json-nya).
// v2 — verifikasi 27 Nov 2026: node main.ts 2x byte-identik, 0 network,
// serve 200, Playwright 0 console error, 4 screenshot <= 256 KiB.
// v3 — verifikasi 27 Nov 2026: node main.ts 2x byte-identik (dossier sha
// 6da01f59…), 0 network, serve 200 semua URL, Playwright 0 console error,
// 4 screenshot <= 256 KiB, kit check --worktree 4 passed / 1 failed
// (transcripts_present, urusan Orchestrator) — sama seperti profil v1/v2.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 }),
);
