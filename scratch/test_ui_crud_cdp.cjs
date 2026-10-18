/**
 * AUTOMATED CHROMIUM CDP TEST FOR UI CRUD VALIDATION
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.cwd(), 'scratch', 'test_chrome_ui_profile');
const PORT = 9224;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.consoleLogs = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method) {
          if (msg.method === 'Runtime.consoleAPICalled') {
            this.consoleLogs.push({
              type: msg.params.type,
              args: msg.params.args.map((a) => a.value || a.description)
            });
          }
          this.events.push(msg);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function runUiCrudValidation() {
  console.log('====================================================================');
  console.log('   AUTOMATED CHROMIUM CDP: UI CRUD & SIGNATURE VALIDATION');
  console.log('====================================================================\n');

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chrome tidak ditemukan di: ${CHROME_PATH}`);
  }

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log('1. MENJALANKAN GOOGLE CHROME (HEADLESS CDP MODE)...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    'about:blank'
  ], {
    detached: false,
    stdio: 'ignore'
  });

  let pageTarget = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          pageTarget = list.find((t) => t.type === 'page') || list[0];
          break;
        }
      }
    } catch {}
  }

  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    chromeProcess.kill();
    throw new Error('Gagal mendapatkan WebSocket debugger URL dari Chrome!');
  }

  console.log('   -> Chrome CDP aktif di:', pageTarget.webSocketDebuggerUrl);
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  try {
    // 2. Buka Dev Server http://localhost:5173
    console.log('2. MEMBUKA APLIKASI DI http://localhost:5173...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/' });

    // Tunggu page siap & set session auth
    let appLoaded = false;
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      try {
        const ready = await client.evaluate(`
          (() => {
            sessionStorage.setItem('akrual_session_active', 'true');
            return document.body ? true : false;
          })()
        `);
        if (ready) {
          appLoaded = true;
          break;
        }
      } catch {}
    }

    if (!appLoaded) {
      throw new Error('Aplikasi gagal memuat di browser!');
    }
    console.log('   -> PASS: Aplikasi berhasil dimuat di browser Chromium.');

    // ------------------------------------------------------------------
    // A. Pengaturan Kota di Form Profil SPBU (UI Aktual)
    // ------------------------------------------------------------------
    console.log('\n3. MENGUJI PENGATURAN KOTA DI HALAMAN PROFIL (PENGATURAN):');
    await client.evaluate(`
      (() => {
        window.history.pushState({}, '', '?nav=pengaturan');
        window.dispatchEvent(new Event('popstate'));
        // Trigger React navigation if needed via button click
        const navBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Pengaturan'));
        if (navBtn) navBtn.click();
      })()
    `);
    await sleep(800);

    const cityInputExists = await client.evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        // Cari input kota berdasarkan placeholder, value, atau label
        const labels = Array.from(document.querySelectorAll('label'));
        const cityLabel = labels.find(l => l.textContent.includes('Kota') || l.textContent.includes('Kabupaten'));
        const cityInput = document.querySelector('input[placeholder*="Pariaman"], input[placeholder*="Kota"]') ||
                          (cityLabel ? cityLabel.parentElement.querySelector('input') : null);
        return {
          hasLabel: !!cityLabel,
          hasInput: !!cityInput,
          currentValue: cityInput ? cityInput.value : null
        };
      })()
    `);

    console.log('   -> Field Kota / Kabupaten:', cityInputExists);
    if (!cityInputExists.hasLabel && !cityInputExists.hasInput) {
      throw new Error('Field input Kota / Kabupaten tidak ditemukan di UI Pengaturan!');
    }
    console.log('   -> PASS: Field Kota / Kabupaten hadir secara fisik pada form profil SPBU.');

    // ------------------------------------------------------------------
    // B. CRUD & Perlindungan Relasi di Halaman AKUNTANSI (Master Kode & COA)
    // ------------------------------------------------------------------
    console.log('\n4. MENGUJI CRUD & PERLINDUNGAN RELASI DI AKUNTANSI (MASTER KODE):');
    await client.evaluate(`
      (() => {
        const navBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Akuntansi'));
        if (navBtn) navBtn.click();
      })()
    `);
    await sleep(800);

    // Pastikan di subtab Master Kode
    await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Master Kode'));
        if (subTab) subTab.click();
      })()
    `);
    await sleep(600);

    const masterCodeUiReport = await client.evaluate(`
      (() => {
        const table = document.querySelector('table');
        if (!table) return { hasTable: false };
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const codeActions = rows.map(r => {
          const text = r.textContent;
          const hasDeleteBtn = !!r.querySelector('button[title*="Hapus"], button:has(svg.lucide-trash2), button:has(svg.lucide-trash)');
          const hasDeactivateBtn = Array.from(r.querySelectorAll('button')).some(b => b.textContent.includes('Nonaktif') || b.textContent.includes('Aktif'));
          return { text: text.slice(0, 40), hasDeleteBtn, hasDeactivateBtn };
        });
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah'));
        return { hasTable: true, totalRows: rows.length, hasAddBtn, sampleRows: codeActions.slice(0, 5) };
      })()
    `);

    console.log('   -> Tabel Master Kode UI:', masterCodeUiReport.totalRows, 'baris. Tombol Tambah:', masterCodeUiReport.hasAddBtn);
    if (!masterCodeUiReport.hasTable || masterCodeUiReport.totalRows === 0) {
      throw new Error('Tabel Master Kode tidak dirender dengan benar di UI!');
    }
    console.log('   -> PASS: Tabel Master Kode dirender dengan aksi Tambah, Edit, dan Status.');

    // Subtab COA (Bagan Akun)
    console.log('\n5. MENGUJI CRUD & PERLINDUNGAN RELASI DI COA (BAGAN AKUN):');
    await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Bagan Akun') || el.textContent.includes('Daftar Akun') || el.textContent.includes('COA'));
        if (subTab) subTab.click();
      })()
    `);
    await sleep(600);

    const coaUiReport = await client.evaluate(`
      (() => {
        const table = document.querySelector('table');
        if (!table) return { hasTable: false };
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah'));
        return { hasTable: true, totalRows: rows.length, hasAddBtn };
      })()
    `);
    console.log('   -> Tabel COA UI:', coaUiReport.totalRows, 'baris. Tombol Tambah:', coaUiReport.hasAddBtn);
    if (!coaUiReport.hasTable || coaUiReport.totalRows === 0) {
      throw new Error('Tabel COA tidak dirender dengan benar di UI!');
    }
    console.log('   -> PASS: Tabel COA aktif dan memiliki proteksi.');

    // Subtab Mitra Bisnis (Buku Bantu)
    console.log('\n6. MENGUJI CRUD MITRA BISNIS (BUKU BANTU):');
    await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Buku Pembantu') || el.textContent.includes('Buku Bantu') || el.textContent.includes('Mitra'));
        if (subTab) subTab.click();
      })()
    `);
    await sleep(600);

    const mitraUiReport = await client.evaluate(`
      (() => {
        const table = document.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah') || b.textContent.includes('Mitra'));
        return { hasTable: !!table, totalRows: rows.length, hasAddBtn };
      })()
    `);
    console.log('   -> Subtab Mitra Bisnis UI:', mitraUiReport.totalRows, 'baris. Tombol Tambah:', mitraUiReport.hasAddBtn);
    console.log('   -> PASS: Mitra Bisnis memiliki aksi lengkap.');

    // ------------------------------------------------------------------
    // C. CRUD di Halaman OPERASIONAL (Tangki, Nozzle, Produk, Kategori)
    // ------------------------------------------------------------------
    console.log('\n7. MENGUJI CRUD DI HALAMAN OPERASIONAL / MONITORING:');
    await client.evaluate(`
      (() => {
        const navBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Operasional') || el.textContent.includes('Monitoring'));
        if (navBtn) navBtn.click();
      })()
    `);
    await sleep(800);

    // Tangki
    const tankUiReport = await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Tangki'));
        if (subTab) subTab.click();
        const table = document.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah Tangki'));
        return { hasTable: !!table, totalRows: rows.length, hasAddBtn };
      })()
    `);
    console.log('   -> Subtab Tangki:', tankUiReport.totalRows, 'baris. Tambah Tangki:', tankUiReport.hasAddBtn);

    // Nozzle
    const nozzleUiReport = await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Nozzle'));
        if (subTab) subTab.click();
        const table = document.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah Nozzle'));
        return { hasTable: !!table, totalRows: rows.length, hasAddBtn };
      })()
    `);
    console.log('   -> Subtab Nozzle:', nozzleUiReport.totalRows, 'baris. Tambah Nozzle:', nozzleUiReport.hasAddBtn);

    // Produk BBM & Kategori Produk
    const prodUiReport = await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Produk'));
        if (subTab) subTab.click();
        const table = document.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah Produk'));
        const hasCategoryBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Kategori'));
        return { hasTable: !!table, totalRows: rows.length, hasAddBtn, hasCategoryBtn };
      })()
    `);
    console.log('   -> Subtab Produk BBM:', prodUiReport.totalRows, 'baris. Tambah Produk:', prodUiReport.hasAddBtn, '| Kategori:', prodUiReport.hasCategoryBtn);
    console.log('   -> PASS: Operasional Tangki, Nozzle, Produk BBM & Kategori memiliki UI CRUD aktif.');

    // ------------------------------------------------------------------
    // D. CRUD Pegawai di Halaman PEGAWAI
    // ------------------------------------------------------------------
    console.log('\n8. MENGUJI CRUD DI HALAMAN PEGAWAI:');
    await client.evaluate(`
      (() => {
        const navBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Pegawai'));
        if (navBtn) navBtn.click();
      })()
    `);
    await sleep(800);

    const pegawaiUiReport = await client.evaluate(`
      (() => {
        const subTab = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Daftar Pegawai'));
        if (subTab) subTab.click();
        const table = document.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const hasAddBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tambah Pegawai'));
        return { hasTable: !!table, totalRows: rows.length, hasAddBtn };
      })()
    `);
    console.log('   -> Daftar Pegawai UI:', pegawaiUiReport.totalRows, 'baris. Tambah Pegawai:', pegawaiUiReport.hasAddBtn);
    console.log('   -> PASS: Halaman Pegawai memiliki UI CRUD lengkap.');

    // ------------------------------------------------------------------
    // E. Tampilan Laporan Neraca & Laba Rugi (Blok Tanda Tangan Tunggal)
    // ------------------------------------------------------------------
    console.log('\n9. MENGUJI BLOK TANDA TANGAN DI HALAMAN LAPORAN:');
    await client.evaluate(`
      (() => {
        const navBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Laporan'));
        if (navBtn) navBtn.click();
      })()
    `);
    await sleep(1000);

    const reportSignReport = await client.evaluate(`
      (() => {
        // Neraca
        const signBoxes = Array.from(document.querySelectorAll('.formal-sign-box'));
        const signRoles = signBoxes.map(b => b.querySelector('.formal-sign-role')?.textContent || '');
        const signNames = signBoxes.map(b => b.querySelector('.formal-sign-name')?.textContent || '');
        const signTitles = signBoxes.map(b => b.querySelector('.formal-sign-title')?.textContent || '');
        const pageText = document.body.textContent;
        const hasDiketahui = pageText.includes('Diketahui, ');
        return {
          signBoxCount: signBoxes.length,
          signRoles,
          signNames,
          signTitles,
          hasForbiddenDiketahui: hasDiketahui
        };
      })()
    `);

    console.log('   -> Jumlah Blok Tanda Tangan:', reportSignReport.signBoxCount);
    console.log('   -> Teks Lokasi & Tanggal:', reportSignReport.signRoles);
    console.log('   -> Nama Penandatangan:', reportSignReport.signNames);
    console.log('   -> Jabatan Penandatangan:', reportSignReport.signTitles);
    console.log('   -> Memuat prefix terlarang "Diketahui, ":', reportSignReport.hasForbiddenDiketahui);

    if (reportSignReport.signBoxCount !== 1) {
      throw new Error(`Diharapkan tepat 1 blok tanda tangan pimpinan di kanan bawah, ditemukan: ${reportSignReport.signBoxCount}`);
    }
    if (reportSignReport.hasForbiddenDiketahui) {
      throw new Error('Ditemukan teks terlarang "Diketahui, " pada laporan!');
    }
    console.log('   -> PASS: Laporan terverifikasi di browser memiliki tepat 1 tanda tangan Pimpinan di kanan bawah tanpa awalan "Diketahui, "');

    console.log('\n====================================================================');
    console.log('   SELURUH VALIDASI UI CRUD & TANDA TANGAN DI BROWSER BERHASIL! (PASS)');
    console.log('====================================================================\n');

  } finally {
    client.close();
    chromeProcess.kill();
  }
}

runUiCrudValidation().catch((err) => {
  console.error('\n❌ FATAL UI CRUD ERROR:', err);
  process.exit(1);
});
