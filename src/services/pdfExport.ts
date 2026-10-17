import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportsData, StationInfo } from '../types';
import { saveOrDownloadPdf, SaveFileResult } from './fileSaver';

// Helper formatting angka akuntansi Indonesia
function formatAccounting(val: number): string {
  if (val === 0) return '0,00';
  const isNegative = val < 0;
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isNegative ? `(${formatted})` : formatted;
}

function sanitizeFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * 1. EXPORT LAPORAN NERACA (PDF STANDALONE)
 */
export async function exportNeracaPdf(
  data: ReportsData,
  stationInfo?: StationInfo,
  period: string = '31-Aug-2026'
): Promise<SaveFileResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const entityName = data.neracaKonsolidasi?.entityName || stationInfo?.name || 'SPBU 34.12301 Pertamina';
  const location = data.neracaKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung';
  const reportTitle = data.neracaKonsolidasi?.title || 'LAPORAN NERACA HARIAN KONSOLIDASI';
  const managerName = stationInfo?.manager || 'Direksi / Pimpinan';

  // Standalone Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(reportTitle, 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(period, 105, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.text(entityName, 105, 27, { align: 'center' });
  const wrappedLocation = doc.splitTextToSize(location, 150);
  doc.text(wrappedLocation, 105, 31, { align: 'center' });

  const headerBottomY = 31 + (wrappedLocation.length * 3.5);

  // Thin dividing line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(14, headerBottomY, 196, headerBottomY);

  // Table Body Rows
  const rows = (data.neracaKonsolidasi?.rows || []).map((row) => {
    const isSectionHeader = row.isSectionHeader;
    const isSubtotal = row.isSubtotal;
    const isGrandTotal = row.isGrandTotal;

    const noText = row.no || '';
    const indent = row.level === 2 ? '  ' : row.level === 3 ? '    ' : row.level === 4 ? '      ' : '';
    const codePrefix = row.code && row.code !== '-' && !isSectionHeader ? `[${row.code}] ` : '';
    const nameText = `${indent}${codePrefix}${row.name}`;

    const saldoAwalText = isSectionHeader && row.saldoAwal === 0 ? '' : formatAccounting(row.saldoAwal);
    const debetText = isSectionHeader && row.debet === 0 ? '' : formatAccounting(row.debet);
    const kreditText = isSectionHeader && row.kredit === 0 ? '' : formatAccounting(row.kredit);
    const saldoAkhirText = isSectionHeader && row.saldoAkhir === 0 ? '' : formatAccounting(row.saldoAkhir);

    return [noText, nameText, saldoAwalText, debetText, kreditText, saldoAkhirText, { isSectionHeader, isSubtotal, isGrandTotal, level: row.level }];
  });

  autoTable(doc, {
    startY: headerBottomY + 3,
    margin: { left: 14, right: 14 },
    head: [
      [
        { content: 'NO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'SANDI & PERKIRAAN', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'SALDO AWAL HARI', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
        { content: 'MUTASI', colSpan: 2, styles: { halign: 'center' } },
        { content: 'SALDO AKHIR', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } }
      ],
      [
        { content: 'DEBET', styles: { halign: 'right' } },
        { content: 'KREDIT', styles: { halign: 'right' } }
      ]
    ],
    body: rows.map(r => r.slice(0, 6) as string[]),
    theme: 'plain',
    headStyles: {
      fillColor: [240, 244, 248],
      textColor: [20, 30, 50],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [180, 180, 180]
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 40, 60],
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: [230, 230, 230]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 72, halign: 'left' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const meta = rows[hookData.row.index]?.[6] as any;
        if (meta) {
          if (meta.isGrandTotal) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [225, 235, 250];
            hookData.cell.styles.fontSize = 8;
          } else if (meta.isSubtotal) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [245, 248, 252];
          } else if (meta.isSectionHeader) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.textColor = [15, 23, 42];
          }
        }
      }
    }
  });

  // Standalone Footer / Tanda Tangan: Hanya 1 blok tanda tangan pimpinan di kanan bawah
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 240;
  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = finalY;
  if (signY > pageHeight - 32) {
    doc.addPage();
    signY = 25;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Diketahui, ${data.neracaKonsolidasi?.signerDate || ''}`, 160, signY, { align: 'center' });

  // Garis tanda tangan
  doc.setDrawColor(50, 60, 80);
  doc.setLineWidth(0.3);
  doc.line(135, signY + 13, 185, signY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text(managerName, 160, signY + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 100);
  doc.text('Pimpinan / Direktur SPBU', 160, signY + 21, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const filename = `Neraca_${sanitizeFilename(period)}.pdf`;
  return await saveOrDownloadPdf(doc, filename);
}

/**
 * 2. EXPORT LAPORAN LABA RUGI (PDF STANDALONE)
 */
export async function exportLabaRugiPdf(
  data: ReportsData,
  stationInfo?: StationInfo,
  period: string = '31 Agustus 2026'
): Promise<SaveFileResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const entityName = data.labaRugiKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954';
  const location = data.labaRugiKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung';
  const reportTitle = data.labaRugiKonsolidasi?.title || 'LAPORAN LABA-RUGI KONSOLIDASI HARIAN';
  const managerName = stationInfo?.manager || 'Direksi / Pimpinan';

  // Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(reportTitle, 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(period, 105, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.text(entityName, 105, 27, { align: 'center' });
  const wrappedLocation = doc.splitTextToSize(location, 150);
  doc.text(wrappedLocation, 105, 31, { align: 'center' });

  const headerBottomY = 31 + (wrappedLocation.length * 3.5);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(14, headerBottomY, 196, headerBottomY);

  // Rows
  const rows = (data.labaRugiKonsolidasi?.rows || []).map((row) => {
    const isTotal = row.isTotal;
    const isGrandTotal = row.isGrandTotal;
    const isSectionHeader = row.isSectionHeader;

    const codeText = row.code || '';
    const indent = row.level === 2 ? '  ' : row.level === 3 ? '    ' : row.level === 4 ? '      ' : '';
    const nameText = `${indent}${row.name}`;

    const saldoKemarin = isSectionHeader && row.saldoKemarin === 0 ? '0,00' : formatAccounting(row.saldoKemarin);
    const debet = isSectionHeader && row.debet === 0 ? '0,00' : formatAccounting(row.debet);
    const kredit = isSectionHeader && row.kredit === 0 ? '0,00' : formatAccounting(row.kredit);
    const saldoAkhir = isSectionHeader && row.saldoAkhir === 0 ? '0,00' : formatAccounting(row.saldoAkhir);

    return [codeText, nameText, saldoKemarin, debet, kredit, saldoAkhir, { isTotal, isGrandTotal, isSectionHeader, level: row.level }];
  });

  autoTable(doc, {
    startY: headerBottomY + 3,
    margin: { left: 14, right: 14 },
    head: [
      [
        { content: 'KODE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'PERKIRAAN', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
        { content: 'SALDO KEMARIN', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
        { content: 'MUTASI', colSpan: 2, styles: { halign: 'center' } },
        { content: 'SALDO AKHIR', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } }
      ],
      [
        { content: 'DEBET', styles: { halign: 'right' } },
        { content: 'KREDIT', styles: { halign: 'right' } }
      ]
    ],
    body: rows.map(r => r.slice(0, 6) as string[]),
    theme: 'plain',
    headStyles: {
      fillColor: [240, 244, 248],
      textColor: [20, 30, 50],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [180, 180, 180]
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 40, 60],
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: [230, 230, 230]
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 66, halign: 'left' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const meta = rows[hookData.row.index]?.[6] as any;
        if (meta) {
          if (meta.isGrandTotal) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [225, 235, 250];
            hookData.cell.styles.fontSize = 8;
          } else if (meta.isTotal) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [245, 248, 252];
          } else if (meta.isSectionHeader) {
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  // Standalone Footer / Tanda Tangan: Hanya 1 blok tanda tangan pimpinan di kanan bawah
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 240;
  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = finalY;
  if (signY > pageHeight - 32) {
    doc.addPage();
    signY = 25;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Diketahui, ${data.labaRugiKonsolidasi?.signerDate || ''}`, 160, signY, { align: 'center' });

  // Garis tanda tangan
  doc.setDrawColor(50, 60, 80);
  doc.setLineWidth(0.3);
  doc.line(135, signY + 13, 185, signY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text(managerName, 160, signY + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 100);
  doc.text('Pimpinan / Direktur SPBU', 160, signY + 21, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const filename = `Laba_Rugi_${sanitizeFilename(period)}.pdf`;
  return await saveOrDownloadPdf(doc, filename);
}

/**
 * 3. EXPORT LAPORAN ARUS KAS (PDF STANDALONE)
 */
export async function exportArusKasPdf(
  data: ReportsData,
  stationInfo?: StationInfo,
  period: string = 'Agustus 2026'
): Promise<SaveFileResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const spbuName = stationInfo?.name || 'SPBU 34.12301 Pertamina';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAPORAN ARUS KAS', 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode: ${period}`, 105, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text(spbuName, 105, 27, { align: 'center' });

  doc.setDrawColor(180, 180, 180);
  doc.line(14, 31, 196, 31);

  const bodyData: any[] = [];

  // Operasional
  bodyData.push([{ content: 'Arus Kas dari Aktivitas Operasi', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 244, 248] } }]);
  let totalOps = 0;
  data.arusKas.operasional.forEach(item => {
    totalOps += item.amount;
    bodyData.push([`  ${item.name}`, `Rp ${item.amount.toLocaleString('id-ID')}`]);
  });
  bodyData.push([{ content: 'Total Arus Kas Operasi', styles: { fontStyle: 'bold' } }, { content: `Rp ${totalOps.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', halign: 'right' } }]);

  // Investasi & Pendanaan
  bodyData.push([{ content: 'Arus Kas dari Aktivitas Investasi & Pendanaan', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 244, 248] } }]);
  let totalInv = 0;
  data.arusKas.investasi.concat(data.arusKas.pendanaan).forEach(item => {
    totalInv += item.amount;
    bodyData.push([`  ${item.name}`, `Rp ${item.amount.toLocaleString('id-ID')}`]);
  });
  bodyData.push([{ content: 'Total Arus Kas Investasi & Pendanaan', styles: { fontStyle: 'bold' } }, { content: `Rp ${totalInv.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', halign: 'right' } }]);

  // Kas Akhir
  const kasAkhir = (data.arusKas.saldoAwal || 0) + totalOps + totalInv;
  bodyData.push([{ content: 'KAS DAN SETARA KAS AKHIR PERIODE', styles: { fontStyle: 'bold', fillColor: [225, 235, 250], fontSize: 9 } }, { content: `Rp ${kasAkhir.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [225, 235, 250], fontSize: 9 } }]);

  autoTable(doc, {
    startY: 34,
    margin: { left: 14, right: 14 },
    head: [['Deskripsi Aliran Kas', { content: 'Jumlah (Rp)', styles: { halign: 'right' } }]],
    body: bodyData,
    theme: 'plain',
    headStyles: { fillColor: [220, 230, 242], textColor: [20, 30, 50], fontStyle: 'bold', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { cellWidth: 43, halign: 'right' }
    }
  });

  const filename = `Arus_Kas_${sanitizeFilename(period)}.pdf`;
  return await saveOrDownloadPdf(doc, filename);
}

/**
 * 4. EXPORT LAPORAN STOK & PENJUALAN BBM (PDF STANDALONE)
 */
export async function exportStokPdf(
  data: ReportsData,
  stationInfo?: StationInfo,
  period: string = 'September 2026'
): Promise<SaveFileResult> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const spbuName = stationInfo?.name || 'SPBU 34.12301 Pertamina';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAPORAN MUTASI STOK & PENJUALAN TERA BBM', 148, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode: ${period} • ${spbuName}`, 148, 22, { align: 'center' });

  const bodyData = data.stokPenjualan.map(item => [
    item.code,
    item.name,
    item.stokAwal.toLocaleString('id-ID'),
    `+${item.pembelian.toLocaleString('id-ID')}`,
    `-${item.penjualan.toLocaleString('id-ID')}`,
    item.stokAkhir.toLocaleString('id-ID'),
    item.kapasitasTanki.toLocaleString('id-ID'),
    `${item.persenTerisi}%`
  ]);

  autoTable(doc, {
    startY: 28,
    margin: { left: 14, right: 14 },
    head: [[
      'KODE',
      'PRODUK BBM',
      { content: 'STOK AWAL (L)', styles: { halign: 'right' } },
      { content: 'PEMBELIAN DO (L)', styles: { halign: 'right' } },
      { content: 'PENJUALAN TERA (L)', styles: { halign: 'right' } },
      { content: 'STOK AKHIR (L)', styles: { halign: 'right' } },
      { content: 'KAPASITAS (L)', styles: { halign: 'right' } },
      { content: 'LEVEL', styles: { halign: 'center' } }
    ]],
    body: bodyData,
    theme: 'grid',
    headStyles: { fillColor: [24, 76, 120], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 32, halign: 'right' },
      7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
    }
  });

  const filename = `Stok_BBM_${sanitizeFilename(period)}.pdf`;
  return await saveOrDownloadPdf(doc, filename);
}
