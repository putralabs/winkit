# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Semua segmen PRD §6 tanpa satu prioritas tunggal (dikonfirmasi user: "semuanya") -
students, office workers, content creators, developers, dan general users.
Situasi: di dalam browser, butuh pemrosesan file kecil yang cepat (convert, kompres,
ekstrak, inspeksi) tanpa membuka situs converter satu-fungsi yang penuh iklan dan
mewajibkan upload.

## Product Purpose

WinKit adalah toolbox file serbaguna di dalam Chrome (extension MV3) dan web,
sehingga pengguna tidak perlu situs berbeda untuk setiap pekerjaan file sederhana.
Alasan ada: kecepatan + privasi (local-first) + satu workflow konsisten.
Sukses = dipublish (Chrome Web Store + hosting web) dan dipakai orang nyata.

## Positioning

Keluasan (57 tools, 8 kategori) + satu workflow 5 langkah yang sama di semua tools +
pemrosesan 100% lokal + UI bilingual EN/ID. Mekanisme pembedanya adalah kombinasi
itu - bukan satu fitur tunggal.

## Operating Context

Extension: popup quick actions, dashboard workspace, context menu klik-kanan,
shortcut Alt+Shift+W. Website: landing + app penuh. Offline-capable kecuali
pengunduhan data bahasa OCR sekali (lalu cache) dan FFmpeg multi-thread yang butuh
header COOP/COEP dari host. Kedua target berbagi satu codebase dan satu bahasa desain.

## Capabilities and Constraints

57 tools / 8 kategori, semua lokal. Batasan keras (tidak ada server):
cloud processing nonaktif (seam siap di `src/shared/cloud.ts`),
tanpa transcode video di extension, tanpa enkripsi PDF,
tanpa dukungan biner DOC legacy, PDF kompleks→Word hanya versi sederhana.
Gratis penuh, tanpa akun. Analytics minimal dan opt-out.
Keputusan terbuka: materi listing Chrome Web Store (belum dipublish).

## Brand Commitments

Nama WinKit, tagline "Your Everyday File Toolkit", logo blue #002BCD (sampled
dari `logo/logo.png`) + action orange #EA580C, Plus Jakarta Sans self-hosted.

## Evidence on Hand

PRD (`prd.md`), design system (`design-system/winkit/MASTER.md`), demo live di
landing yang menjalankan engine asli. Tidak ada testimoni, metrik penggunaan,
press, atau data lain - tidak boleh difabrikasi oleh pekerjaan desain berikutnya.

## Product Principles

1. Private by architecture, bukan by promise - file tidak keluar dari browser.
2. Satu workflow konsisten untuk semua tools; user belajar sekali.
3. Mudah untuk awam, berguna untuk power user (batch, konfigurasi advanced).
4. Gratis selamanya; bilingual dan keyboard-first sebagai akses, bukan hiasan.
5. Jujur soal batas - UI menyatakan yang tidak bisa dilakukan, bukan gagal diam-diam.

## Accessibility & Inclusion

Navigasi keyboard penuh, focus states terlihat, screen reader labels, hormati
prefers-reduced-motion, kontras teks ≥4.5:1, UI bilingual EN/ID.
