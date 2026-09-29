# DOKUMEN PERENCANAAN DAN ANALISIS KEBUTUHAN (REQUIREMENT PLANNING)
**Proyek:** Sistem Informasi Pembukuan & Operasional SPBU  
**Fase Saat Ini:** Requirement Gathering / Requirement Analysis  
**Status Dokumen:** Baseline Sementara (Menunggu Konfirmasi Client)  
**Terakhir Diperbarui:** 2026-09-24  

---

## 1. Target Perangkat & Distribusi (Target Device)

- **Perangkat Utama:** Tablet Android (Laptop/PC **bukan** perangkat operasional utama).
- **Target Distribusi:** APK Android (instalasi langsung ke perangkat tablet).
- **Kandidat Arsitektur Teknologi (Under Consideration):**
  - **Frontend:** React + Vite
  - **Mobile Container / Bridge:** Capacitor
  - **Local Database:** SQLite
- **Status Implementasi:**
  - Kandidat teknologi ini merupakan bahan pertimbangan dan **belum dikunci sebagai keputusan final**.
  - **Belum dilakukan instalasi package/dependency** maupun pembuatan project code/APK pada tahap ini.

---

## 2. Arah Desain & Palet Warna (Design Direction)

### 2.1 Tema Warna
Client menetapkan tema visual: **Biru, Putih, dengan sedikit aksen Merah**.  
*(Catatan: Tema hijau dari prototype lama tidak digunakan sebagai warna final).*

### 2.2 Baseline Palet Warna (Hex Codes)

| Kategori Elemen | Token Warna | Hex Code | Penggunaan & Aturan |
| :--- | :--- | :--- | :--- |
| **Primary Blue** | Warna Utama | `#1565C0` | Header, tombol utama/primer, navigasi aktif, komponen penting |
| **Dark Blue** | Biru Gelap | `#0D47A1` | State hover/pressed pada elemen primer, aksen kontras tinggi |
| **Light Blue** | Biru Muda | `#E3F2FD` | Background badge/chip aktif, highlight baris tabel terpilih |
| **White** | Putih | `#FFFFFF` | Surface kartu (card), container form, panel konten utama |
| **Background** | Abu Netral Terang | `#F5F7FA` | Latar belakang layar aplikasi (canvas tablet) |
| **Red Accent** | Aksen Merah | `#D32F2F` | **Hanya sebagai aksen**: indikator error, warning, status penting, tombol destruktif (bukan warna dominan) |
| **Dark Text** | Teks Utama | `#1F2937` | Tipografi heading, body text utama |
| **Muted Text** | Teks Sekunder | `#6B7280` | Label pembantu, placeholder, teks metadata/sub-info |
| **Border** | Garis Pembatas | `#D9E2EC` | Border input field, pemisah tabel, garis batas card |

### 2.3 Prinsip Tampilan Tablet
- Dirancang untuk kenyamanan layar sentuh (touch targets minimal 44x44px).
- Layout responsif optimal untuk resolusi tablet (landscape/portrait).
- Struktur/layout dari prototype lama dapat dijadikan referensi alur, tetapi styling mengikuti baseline biru-putih.

---

## 3. Requirement Fungsional yang Diketahui (Known Requirements)

### 3.1 Manajemen Pengguna & Sesi Operasional
- **Autentikasi & Otorisasi:** Login pengguna dengan pembagian peran (Role): Admin, Kasir, Pimpinan.
- **Sesi Kerja (Shift):** Pencatatan dan pembagian sesi kerja kasir/operator.

### 3.2 Operasional Transaksi & BBM
- **Input Transaksi:** Modul pencatatan transaksi harian.
- **Penjualan BBM:** Transaksi penjualan bahan bakar minyak.
- **Pembelian & Biaya:**
  - Pembelian produk/BBM dari supplier.
  - Biaya operasional SPBU.
- **Entitas Operasional BBM:**
  - Produk (Jenis BBM & komoditas)
  - Nozzle (Penyalur BBM)
  - Tanki (Penyimpanan BBM)
  - Tera (Pengukuran meteran BBM)
  - Transaksi
  - Persediaan / Stok BBM & barang

### 3.3 Akuntansi & Pencatatan Finansial
- **Master Kode:**
  - Konsep alur: `KODE TRANSAKSI → MASTER KODE → MAPPING AKUNTANSI → JURNAL`
  - Master kode harus bersifat **dinamis** dan dikonfigurasi melalui sistem (tidak hard-coded di kode program).
- **Pencatatan Transaksi Finansial:**
  - Jurnal & Detail Jurnal (Debit/Kredit).
  - Akun (Bagan Akun / Chart of Accounts).
  - Periode Akuntansi.
  - Buku Besar (General Ledger).
  - Buku Pembantu (Sub-ledger).
- **Integritas Data:**
  - Validasi data input.
  - Fitur perbaikan/koreksi data transaksi.

### 3.4 Laporan & Output Dokumen
- **Jenis Laporan Keuangan & Operasional:**
  - Neraca (Balance Sheet)
  - Laba Rugi (Income Statement)
  - Arus Kas (Cash Flow)
  - Laporan Stok dan Penjualan
- **Format Output:**
  - Export ke file PDF.
  - Export ke file Excel (.xlsx / spreadsheet).
  - Cetak (Print) laporan dan bukti transaksi / struk.

---

## 4. Ketentuan Khusus Terkait Tera BBM

Berdasarkan data awal yang diberikan client:
- **Rumus Volume Tera Sementara:**
  $$\text{Volume} = \text{Tera Akhir} - \text{Tera Awal}$$
- **Rumus Nilai Penjualan Sementara:**
  $$\text{Nilai Penjualan} = \text{Volume} \times \text{Harga Jual}$$
- **Field yang Terlihat pada Rancangan Draft:**
  - `tera_awal`
  - `tera_akhir`
  - `volume`
  - `selisih`
  - `id_nozzle`
  - `id_transaksi`

> **BATASAN ANALISIS (STRICT RULES):**
> 1. Jangan mengasumsikan arti field `selisih`.
> 2. Jangan membuat formula/rumus tambahan di luar yang diberikan.
> 3. Jangan mengubah stok atau jurnal akuntansi berdasarkan asumsi mekanisme Tera.
> 4. Mekanisme final Tera menunggu konfirmasi langsung dari client.

---

## 5. Status ERD Client (Initial Draft)

Client telah menyajikan rancangan awal ERD yang mencakup tabel/entitas berikut:
1. `Users`
2. `Shift`
3. `Transaksi`
4. `Detail_Tera`
5. `Nozzle`
6. `Tanki`
7. `Produk`
8. `Pembelian`
9. `Detail_Pembelian`
10. `Persediaan`
11. `Master_Kode`
12. `Jurnal`
13. `Detail_Jurnal`
14. `Akun`
15. `Periode_Akuntansi`
16. `Dokumen_Laporan`
17. `Laporan`
18. `Kas`

> **STATUS ERD:**
> - Entitas di atas **BELUM FINAL** dan masih berupa draft referensi dari client.
> - Tidak diperkenankan membuat schema database final atau mengubah relasi tanpa klarifikasi.

---

## 6. Daftar Pertanyaan Terbuka / Belum Dikonfirmasi (OPEN QUESTIONS)

Berikut daftar pertanyaan terbuka yang **wajib dikonfirmasi** kepada client sebelum masuk ke tahap perancangan database detail dan arsitektur teknis:

1. **Spesifikasi Perangkat Tablet:**
   - Apa merek, tipe/model, dan versi OS Android minimum dari tablet yang akan digunakan di SPBU?
2. **Kuantitas & Topologi Perangkat:**
   - Apakah sistem hanya berjalan pada **1 tablet tunggal (standalone)**, atau akan ada **lebih dari 1 tablet/perangkat** yang beroperasi bersamaan di lokasi?
3. **Kebutuhan Konektivitas Jaringan (Offline Mode):**
   - Apakah aplikasi wajib beroperasi **100% offline tanpa internet/LAN sama sekali**, atau ada jaringan lokal (WiFi internal SPBU)/koneksi berkala ke cloud?
4. **Mekanisme Backup & Restore Database:**
   - Bagaimana mekanisme backup dan pemulihan data lokal tablet (misal: export file database ke USB flashdisk / SD Card, backup berkala ke cloud storage, atau transfer lokal)?
5. **Siklus Kerja Shift:**
   - Apakah shift kerja kasir/operator memiliki alur wajib untuk dibuka (*open shift*) dan ditutup (*close shift*), termasuk proses rekonsiliasi kas fisik di awal/akhir shift?
6. **Multi-Operator per Shift:**
   - Apakah satu sesi shift hanya berlaku untuk satu kasir, atau satu shift dapat digunakan bersama oleh beberapa kasir/operator?
7. **Definisi Field "Selisih" pada Detail Tera:**
   - Apa arti, fungsi bisnis, dan formula perhitungan dari field `selisih` pada entitas `Detail_Tera`? Apakah selisih antara meter arus nozzle dengan tangki, atau toleransi tera dispenser?
8. **Relasi Transaksi dengan Detail Tera:**
   - Apakah satu transaksi penjualan dapat menampung beberapa record `Detail_Tera` (misal dari beberapa nozzle sekaligus), atau 1 transaksi mewakili 1 nozzle per tera?
9. **Mekanisme Mapping Akuntansi Master Kode:**
   - Bagaimana aturan mapping `Master_Kode` menghasilkan jurnal otomatis untuk transaksi yang memiliki lebih dari satu pasang debit/kredit (jurnal majemuk / multi-split)?
10. **Metode Penilaian Persediaan / HPP:**
    - Apakah perhitungan Harga Pokok Penjualan (HPP) dan mutasi stok menggunakan metode perpetual inventory (FIFO / Average), atau menggunakan metode periodik / fisik?
11. **Penyimpanan Dokumen PDF / Excel:**
    - Apakah file PDF dan Excel yang di-generate hanya berfungsi sebagai file download sesaat (on-demand export), atau wajib disimpan di dalam storage perangkat sebagai riwayat/histori dokumen (`Dokumen_Laporan`)?
12. **Mekanisme & Hardware Percetakan (Print):**
    - Bagaimana mekanisme cetak bukti transaksi/laporan: apakah langsung mencetak via koneksi Bluetooth/USB ke printer thermal mobile dari tablet, atau melalui printer jaringan (WiFi/LAN desktop)?

---

## 7. Batasan & Larangan Saat Ini (Constraints)

- [x] **Dilarang memulai coding aplikasi.**
- [x] **Dilarang membuat database (SQLite / MySQL / dll).**
- [x] **Dilarang membuat bundle aplikasi (APK).**
- [x] **Dilarang menginstal package atau dependensi (npm/yarn/dll).**
- [x] **Dilarang membuat skema database final atau ERD final.**
- [x] **Dilarang membuat UI final.**
- [x] **Dilarang mengambil asumsi sepihak mengenai logika bisnis yang masih berstatus OPEN.**
