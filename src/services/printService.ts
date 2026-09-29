import { ReportsData, StationInfo } from '../types';

function formatCurrency(val: number): string {
  if (val === 0) return '0,00';
  const isNegative = val < 0;
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isNegative ? `(${formatted})` : formatted;
}

/**
 * Print Report Document via dedicated isolated iframe
 * Memastikan Sidebar, Topbar, tombol, dan seluruh shell UI aplikasi
 * TIDAK PERNAH ikut tercetak.
 */
export function printHtmlDocument(title: string, bodyHtml: string) {
  if (typeof window === 'undefined') return;

  const existingIframe = document.getElementById('report-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'report-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: #0F172A;
            background: #FFFFFF;
            font-size: 11px;
            line-height: 1.35;
          }
          .report-header {
            text-align: center;
            margin-bottom: 12px;
            border-bottom: 1.5px solid #334155;
            padding-bottom: 8px;
          }
          .report-title {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .report-period {
            font-size: 11.5px;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .report-entity {
            font-size: 10.5px;
            font-weight: 600;
            color: #1E293B;
          }
          .report-location {
            font-size: 10px;
            color: #475569;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 10px;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #CBD5E1;
            padding: 4px 6px;
          }
          table.report-table th {
            background-color: #F1F5F9;
            font-weight: 700;
            text-align: center;
            vertical-align: middle;
            font-size: 9.5px;
          }
          .num-col {
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }
          .code-col {
            font-family: monospace;
            font-weight: 700;
            text-align: center;
          }
          .section-header {
            font-weight: 700;
            background-color: #F8FAFC;
          }
          .subtotal-row {
            font-weight: 700;
            background-color: #F1F5F9;
          }
          .grandtotal-row {
            font-weight: 800;
            background-color: #E2E8F0;
            border-top: 2px solid #334155;
            border-bottom: 3px double #334155;
          }
          .sign-area {
            display: flex;
            justify-content: space-between;
            margin-top: 24px;
            page-break-inside: avoid;
          }
          .sign-box {
            width: 220px;
            text-align: center;
          }
          .sign-line {
            height: 48px;
            border-bottom: 1px solid #334155;
            margin-bottom: 6px;
          }
          .sign-name {
            font-weight: 700;
            font-size: 10.5px;
          }
          .sign-title {
            font-size: 9.5px;
            color: #475569;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
  }, 250);
}

/**
 * Print Neraca Report Document
 */
export function printNeracaReport(data: ReportsData, stationInfo?: StationInfo, period: string = '31-Aug-2026') {
  const entityName = data.neracaKonsolidasi?.entityName || stationInfo?.name || 'SPBU 34.12301 Pertamina';
  const location = data.neracaKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung';
  const title = data.neracaKonsolidasi?.title || 'LAPORAN NERACA HARIAN KONSOLIDASI';

  const rowsHtml = (data.neracaKonsolidasi?.rows || []).map((row) => {
    let rowClass = '';
    if (row.isGrandTotal) rowClass = 'grandtotal-row';
    else if (row.isSubtotal) rowClass = 'subtotal-row';
    else if (row.isSectionHeader) rowClass = 'section-header';

    const paddingLeft = row.level === 2 ? '14px' : row.level === 3 ? '24px' : row.level === 4 ? '34px' : '4px';
    const codeTag = row.code && row.code !== '-' && !row.isSectionHeader ? `<span style="font-family: monospace; font-weight: 700; margin-right: 6px;">${row.code}</span>` : '';

    return `
      <tr class="${rowClass}">
        <td style="text-align: center;">${row.no || ''}</td>
        <td style="padding-left: ${paddingLeft};">${codeTag}${row.name}</td>
        <td class="num-col">${row.isSectionHeader && row.saldoAwal === 0 ? '' : formatCurrency(row.saldoAwal)}</td>
        <td class="num-col">${row.isSectionHeader && row.debet === 0 ? '' : formatCurrency(row.debet)}</td>
        <td class="num-col">${row.isSectionHeader && row.kredit === 0 ? '' : formatCurrency(row.kredit)}</td>
        <td class="num-col">${row.isSectionHeader && row.saldoAkhir === 0 ? '' : formatCurrency(row.saldoAkhir)}</td>
      </tr>
    `;
  }).join('');

  const bodyHtml = `
    <div class="report-header">
      <div class="report-title">${title}</div>
      <div class="report-period">${period}</div>
      <div class="report-entity">${entityName}</div>
      <div class="report-location">${location}</div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 35px;">NO</th>
          <th rowspan="2" style="text-align: left; padding-left: 8px;">SANDI & PERKIRAAN</th>
          <th rowspan="2" style="width: 110px;">SALDO AWAL HARI</th>
          <th colspan="2">MUTASI</th>
          <th rowspan="2" style="width: 110px;">SALDO AKHIR</th>
        </tr>
        <tr>
          <th style="width: 90px;">DEBET</th>
          <th style="width: 90px;">KREDIT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="sign-area">
      <div class="sign-box">
        <div style="font-size: 9.5px;">Diketahui, ${data.neracaKonsolidasi?.signerDate || '01/09/26'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">Direksi / Pimpinan</div>
        <div class="sign-title">${entityName}</div>
      </div>
      <div class="sign-box">
        <div style="font-size: 9.5px;">Pembukuan</div>
        <div class="sign-line"></div>
        <div class="sign-name">Bagian Akuntansi & Pelaporan</div>
        <div class="sign-title">${location}</div>
      </div>
    </div>
  `;

  printHtmlDocument(`Neraca - ${period}`, bodyHtml);
}

/**
 * Print Laba Rugi Report Document
 */
export function printLabaRugiReport(data: ReportsData, stationInfo?: StationInfo, period: string = '31 Agustus 2026') {
  const entityName = data.labaRugiKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954';
  const location = data.labaRugiKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung';
  const title = data.labaRugiKonsolidasi?.title || 'LAPORAN LABA-RUGI KONSOLIDASI HARIAN';

  const rowsHtml = (data.labaRugiKonsolidasi?.rows || []).map((row) => {
    let rowClass = '';
    if (row.isGrandTotal) rowClass = 'grandtotal-row';
    else if (row.isTotal) rowClass = 'subtotal-row';
    else if (row.isSectionHeader) rowClass = 'section-header';

    const paddingLeft = row.level === 2 ? '14px' : row.level === 3 ? '24px' : row.level === 4 ? '34px' : '4px';

    return `
      <tr class="${rowClass}">
        <td class="code-col">${row.code || ''}</td>
        <td style="padding-left: ${paddingLeft};">${row.name}</td>
        <td class="num-col">${row.isSectionHeader && row.saldoKemarin === 0 ? '0,00' : formatCurrency(row.saldoKemarin)}</td>
        <td class="num-col">${row.isSectionHeader && row.debet === 0 ? '0,00' : formatCurrency(row.debet)}</td>
        <td class="num-col">${row.isSectionHeader && row.kredit === 0 ? '0,00' : formatCurrency(row.kredit)}</td>
        <td class="num-col">${row.isSectionHeader && row.saldoAkhir === 0 ? '0,00' : formatCurrency(row.saldoAkhir)}</td>
      </tr>
    `;
  }).join('');

  const bodyHtml = `
    <div class="report-header">
      <div class="report-title">${title}</div>
      <div class="report-period">${period}</div>
      <div class="report-entity">${entityName}</div>
      <div class="report-location">${location}</div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 50px;">KODE</th>
          <th rowspan="2" style="text-align: left; padding-left: 8px;">PERKIRAAN</th>
          <th rowspan="2" style="width: 110px;">SALDO KEMARIN</th>
          <th colspan="2">MUTASI</th>
          <th rowspan="2" style="width: 110px;">SALDO AKHIR</th>
        </tr>
        <tr>
          <th style="width: 90px;">DEBET</th>
          <th style="width: 90px;">KREDIT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="sign-area">
      <div class="sign-box">
        <div style="font-size: 9.5px;">Diketahui,</div>
        <div class="sign-line"></div>
        <div class="sign-name">Pimpinan / Direktur SPBU</div>
        <div class="sign-title">${entityName}</div>
      </div>
      <div class="sign-box">
        <div style="font-size: 9.5px;">Pembukuan,</div>
        <div class="sign-line"></div>
        <div class="sign-name">Bagian Akuntansi & Pajak</div>
        <div class="sign-title">${location}</div>
      </div>
    </div>
  `;

  printHtmlDocument(`Laba Rugi - ${period}`, bodyHtml);
}

/**
 * Print Arus Kas Report Document
 */
export function printArusKasReport(data: ReportsData, stationInfo?: StationInfo, period: string = 'Agustus 2026') {
  const spbuName = stationInfo?.name || 'SPBU 34.12301 Pertamina';

  let totalOps = 0;
  const opsRows = data.arusKas.operasional.map((item) => {
    totalOps += item.amount;
    return `<tr><td style="padding-left: 18px;">${item.name}</td><td class="num-col">Rp ${item.amount.toLocaleString('id-ID')}</td></tr>`;
  }).join('');

  let totalInv = 0;
  const invRows = data.arusKas.investasi.concat(data.arusKas.pendanaan).map((item) => {
    totalInv += item.amount;
    return `<tr><td style="padding-left: 18px;">${item.name}</td><td class="num-col">Rp ${item.amount.toLocaleString('id-ID')}</td></tr>`;
  }).join('');

  const kasAkhir = (data.arusKas.saldoAwal || 0) + totalOps + totalInv;

  const bodyHtml = `
    <div class="report-header">
      <div class="report-title">LAPORAN ARUS KAS</div>
      <div class="report-period">Periode: ${period}</div>
      <div class="report-entity">${spbuName}</div>
    </div>

    <table class="report-table" style="max-width: 600px; margin: 0 auto;">
      <thead>
        <tr>
          <th style="text-align: left;">DESKRIPSI ARUS KAS</th>
          <th style="width: 140px; text-align: right;">NOMINAL (RP)</th>
        </tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="2">Arus Kas dari Aktivitas Operasi</td></tr>
        ${opsRows}
        <tr class="subtotal-row"><td>Total Arus Kas Operasi</td><td class="num-col">Rp ${totalOps.toLocaleString('id-ID')}</td></tr>

        <tr class="section-header"><td colspan="2">Arus Kas dari Aktivitas Investasi & Pendanaan</td></tr>
        ${invRows}
        <tr class="subtotal-row"><td>Total Arus Kas Investasi & Pendanaan</td><td class="num-col">Rp ${totalInv.toLocaleString('id-ID')}</td></tr>

        <tr class="grandtotal-row"><td>KAS DAN SETARA KAS AKHIR PERIODE</td><td class="num-col">Rp ${kasAkhir.toLocaleString('id-ID')}</td></tr>
      </tbody>
    </table>
  `;

  printHtmlDocument(`Arus Kas - ${period}`, bodyHtml);
}

/**
 * Print Stok & Penjualan Report Document
 */
export function printStokReport(data: ReportsData, stationInfo?: StationInfo, period: string = 'September 2026') {
  const spbuName = stationInfo?.name || 'SPBU 34.12301 Pertamina';

  const rowsHtml = data.stokPenjualan.map((row) => `
    <tr>
      <td class="code-col">${row.code}</td>
      <td style="font-weight: 600;">${row.name}</td>
      <td class="num-col">${row.stokAwal.toLocaleString('id-ID')}</td>
      <td class="num-col">+${row.pembelian.toLocaleString('id-ID')}</td>
      <td class="num-col">-${row.penjualan.toLocaleString('id-ID')}</td>
      <td class="num-col" style="font-weight: 700;">${row.stokAkhir.toLocaleString('id-ID')}</td>
      <td class="num-col">${row.kapasitasTanki.toLocaleString('id-ID')}</td>
      <td style="text-align: center; font-weight: 700;">${row.persenTerisi}%</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <div class="report-header">
      <div class="report-title">LAPORAN MUTASI STOK & PENJUALAN TERA BBM</div>
      <div class="report-period">Periode: ${period} • ${spbuName}</div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th>KODE</th>
          <th style="text-align: left;">PRODUK BBM</th>
          <th>STOK AWAL (L)</th>
          <th>PEMBELIAN DO (L)</th>
          <th>PENJUALAN TERA (L)</th>
          <th>STOK AKHIR (L)</th>
          <th>KAPASITAS (L)</th>
          <th>LEVEL</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  printHtmlDocument(`Stok BBM - ${period}`, bodyHtml);
}
