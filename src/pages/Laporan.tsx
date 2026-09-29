import React, { useState } from 'react';
import { PageHeader } from '../components/common';
import { Card, Button } from '../components/ui';
import {
  ReportsData,
  ToastType
} from '../types';
import { useAppContext } from '../context/AppContext';
import {
  exportNeracaPdf,
  exportLabaRugiPdf,
  exportArusKasPdf,
  exportStokPdf
} from '../services/pdfExport';
import {
  printNeracaReport,
  printLabaRugiReport,
  printArusKasReport,
  printStokReport
} from '../services/printService';

export interface LaporanPageProps {
  mockData?: {
    mockReports: ReportsData;
  };
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function LaporanPage({
  activeSubTab = 'neraca',
  showToast
}: LaporanPageProps) {
  const { reports, stationInfo } = useAppContext();
  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'neraca');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('31 Agustus 2026');

  React.useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  const handleExportPDF = () => {
    try {
      let filename = '';
      if (activeTab === 'neraca') {
        filename = exportNeracaPdf(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'laba_rugi') {
        filename = exportLabaRugiPdf(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'arus_kas') {
        filename = exportArusKasPdf(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'stok_penjualan') {
        filename = exportStokPdf(reports, stationInfo, selectedPeriod);
      }
      showToast(`Dokumen PDF berhasil diunduh: ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor PDF laporan.', 'danger');
    }
  };


  const handlePrint = () => {
    try {
      if (activeTab === 'neraca') {
        printNeracaReport(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'laba_rugi') {
        printLabaRugiReport(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'arus_kas') {
        printArusKasReport(reports, stationInfo, selectedPeriod);
      } else if (activeTab === 'stok_penjualan') {
        printStokReport(reports, stationInfo, selectedPeriod);
      }
      showToast('Perintah cetak dokumen laporan dikirim.', 'primary');
    } catch (err) {
      console.error(err);
      showToast('Gagal mencetak dokumen laporan.', 'danger');
    }
  };

  // Helper formatting angka resmi laporan keuangan sesuai dokumen referensi PDF
  const formatAccountingCurrency = (val: number): string => {
    if (val === 0) return '0,00';
    const isNegative = val < 0;
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isNegative ? `(${formatted})` : formatted;
  };

  return (
    <div>
      {/* Page Header khusus untuk laporan Arus Kas & Stok BBM, sedangkan Neraca & Laba Rugi langsung menampilkan dokumen resmi */}
      {activeTab === 'arus_kas' && (
        <PageHeader
          category="Laporan"
          title="Laporan Arus Kas"
          subtitle="Arus kas dari aktivitas operasi, investasi, dan pendanaan"
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          }
        />
      )}

      {activeTab === 'stok_penjualan' && (
        <PageHeader
          category="Laporan"
          title="Stok & Penjualan BBM"
          subtitle="Rekapitulasi mutasi volume stok, penerimaan DO, dan penjualan tera nozzle"
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          }
        />
      )}

      {/* Filter Periode Sederhana (hanya untuk tab Arus Kas & Stok karena Neraca dan Laba Rugi memiliki toolbar dokumen resmi) */}
      {activeTab !== 'neraca' && activeTab !== 'laba_rugi' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            maxWidth: 'fit-content'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Periode:</span>
          <select
            className="form-select"
            style={{ width: '180px', minHeight: '36px', padding: '4px 8px' }}
            value={selectedPeriod}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(e.target.value)}
          >
            <option value="31 Agustus 2026">31 Agustus 2026</option>
            <option value="September 2026">September 2026</option>
            <option value="Juli 2026">Juli 2026</option>
            <option value="Tahun 2026">Tahun 2026</option>
          </select>
          <Button variant="primary" size="sm" onClick={() => showToast(`Laporan ${selectedPeriod} dimuat.`)}>
            Tampilkan
          </Button>
        </div>
      )}

      {/* TAB 1: NERACA (LAPORAN RESMI BERBASIS DOKUMEN REFERENSI PDF) */}
      {activeTab === 'neraca' && (
        <div className="report-paper-container">
          {/* Simple Toolbar di luar dokumen laporan */}
          <div className="formal-report-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Periode:</span>
              <select
                className="form-select"
                style={{ width: '190px', minHeight: '34px', padding: '4px 8px' }}
                value={selectedPeriod}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(e.target.value)}
              >
                <option value="31-Aug-2026">31-Aug-2026</option>
                <option value="31 Agustus 2026">31 Agustus 2026</option>
                <option value="30 September 2026">30 September 2026</option>
                <option value="31 Juli 2026">31 Juli 2026</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => showToast(`Laporan Neraca per ${selectedPeriod} dimuat.`)}
              >
                Tampilkan
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          </div>

          {/* Lembar Dokumen Laporan Resmi */}
          <div className="formal-report-paper">
            {/* Header Laporan */}
            <div className="formal-report-header">
              <div className="formal-report-title">
                {reports.neracaKonsolidasi?.title || 'LAPORAN NERACA HARIAN KONSOLIDASI'}
              </div>
              <div className="formal-report-period">
                {selectedPeriod || reports.neracaKonsolidasi?.periodDate || '31-Aug-2026'}
              </div>
              <div className="formal-report-entity">
                {reports.neracaKonsolidasi?.entityName || 'PT BPR Ganto Nagari 1954'}
              </div>
              <div className="formal-report-location">
                {reports.neracaKonsolidasi?.location || 'Lubuk alung'}
              </div>
            </div>

            {/* Tabel Utama Laporan Neraca */}
            <div className="formal-report-table-wrapper">
              <table className="formal-report-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '45px' }}>NO</th>
                    <th rowSpan={2} style={{ width: '380px', textAlign: 'left', paddingLeft: '8px' }}>SANDI & PERKIRAAN</th>
                    <th rowSpan={2} className="num-col" style={{ width: '135px' }}>SALDO AWAL HARI</th>
                    <th colSpan={2} style={{ width: '230px' }}>MUTASI</th>
                    <th rowSpan={2} className="num-col" style={{ width: '135px' }}>SALDO AKHIR</th>
                  </tr>
                  <tr>
                    <th className="num-col" style={{ width: '115px' }}>DEBET</th>
                    <th className="num-col" style={{ width: '115px' }}>KREDIT</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.neracaKonsolidasi?.rows.map((row, idx) => {
                    const isGrandTotal = row.isGrandTotal;
                    const isSubtotal = row.isSubtotal;
                    const isSectionHeader = row.isSectionHeader;

                    let rowClass = `formal-row-level-${row.level}`;
                    if (isGrandTotal) {
                      rowClass = 'formal-row-grand-total';
                    } else if (isSubtotal) {
                      rowClass = 'formal-row-total';
                    }

                    const indentClass = `indent-level-${row.level}`;

                    return (
                      <tr key={idx} className={rowClass}>
                        <td className="no-col">{row.no || ''}</td>
                        <td className={indentClass}>
                          {row.code && row.code !== '-' && !isSectionHeader && (
                            <span className="neraca-code">{row.code}</span>
                          )}
                          {row.code === '-' && !isSectionHeader && (
                            <span className="neraca-code">-</span>
                          )}
                          <span style={row.isContra ? { color: '#334155' } : undefined}>
                            {row.name}
                          </span>
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.saldoAwal === 0
                            ? ''
                            : formatAccountingCurrency(row.saldoAwal)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.debet === 0
                            ? ''
                            : formatAccountingCurrency(row.debet)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.kredit === 0
                            ? ''
                            : formatAccountingCurrency(row.kredit)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.saldoAkhir === 0
                            ? ''
                            : formatAccountingCurrency(row.saldoAkhir)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="formal-report-sign-area">
              <div className="formal-sign-box">
                <div className="formal-sign-role">Diketahui {reports.neracaKonsolidasi?.signerDate || '01/09/26'}</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Direksi / Pimpinan</div>
                <div className="formal-sign-title">{reports.neracaKonsolidasi?.entityName || 'PT BPR Ganto Nagari 1954'}</div>
              </div>
              <div className="formal-sign-box">
                <div className="formal-sign-role">Pembukuan</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Bagian Akuntansi & Pelaporan</div>
                <div className="formal-sign-title">{reports.neracaKonsolidasi?.location || 'Lubuk Alung'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LABA RUGI (LAPORAN RESMI BERBASIS DOKUMEN REFERENSI) */}
      {activeTab === 'laba_rugi' && (
        <div className="report-paper-container">
          {/* Simple Toolbar di luar dokumen laporan */}
          <div className="formal-report-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Periode:</span>
              <select
                className="form-select"
                style={{ width: '190px', minHeight: '34px', padding: '4px 8px' }}
                value={selectedPeriod}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(e.target.value)}
              >
                <option value="31 Agustus 2026">31 Agustus 2026</option>
                <option value="30 September 2026">30 September 2026</option>
                <option value="31 Juli 2026">31 Juli 2026</option>
                <option value="Tahun 2026">Tahun 2026</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => showToast(`Laporan Laba-Rugi per ${selectedPeriod} dimuat.`)}
              >
                Tampilkan
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          </div>

          {/* Lembar Dokumen Laporan Resmi */}
          <div className="formal-report-paper">
            {/* Header Laporan */}
            <div className="formal-report-header">
              <div className="formal-report-title">
                {reports.labaRugiKonsolidasi?.title || 'LAPORAN LABA-RUGI KONSOLIDASI HARIAN'}
              </div>
              <div className="formal-report-period">
                {selectedPeriod || reports.labaRugiKonsolidasi?.periodDate || '31 Agustus 2026'}
              </div>
              <div className="formal-report-entity">
                {reports.labaRugiKonsolidasi?.entityName || 'PT SPBU Mitra Akrual 1954'}
              </div>
              <div className="formal-report-location">
                {reports.labaRugiKonsolidasi?.location || 'Lubuk alung'}
              </div>
            </div>

            {/* Tabel Utama Laporan */}
            <div className="formal-report-table-wrapper">
              <table className="formal-report-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '65px' }}>KODE</th>
                    <th rowSpan={2} style={{ width: '360px', textAlign: 'left', paddingLeft: '8px' }}>PERKIRAAN</th>
                    <th rowSpan={2} className="num-col" style={{ width: '135px' }}>SALDO KEMARIN</th>
                    <th colSpan={2} style={{ width: '230px' }}>MUTASI</th>
                    <th rowSpan={2} className="num-col" style={{ width: '135px' }}>SALDO AKHIR</th>
                  </tr>
                  <tr>
                    <th className="num-col" style={{ width: '115px' }}>DEBET</th>
                    <th className="num-col" style={{ width: '115px' }}>KREDIT</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.labaRugiKonsolidasi?.rows.map((row, idx) => {
                    const isTotal = row.isTotal;
                    const isGrandTotal = row.isGrandTotal;
                    const isSectionHeader = row.isSectionHeader;

                    let rowClass = `formal-row-level-${row.level}`;
                    if (isGrandTotal) {
                      rowClass = 'formal-row-grand-total';
                    } else if (isTotal) {
                      rowClass = 'formal-row-total';
                    }

                    const indentClass = `indent-level-${row.level}`;

                    return (
                      <tr key={idx} className={rowClass}>
                        <td className="code-col">{row.code || ''}</td>
                        <td className={indentClass}>{row.name}</td>
                        <td className="num-col">
                          {isSectionHeader && row.saldoKemarin === 0
                            ? '0,00'
                            : formatAccountingCurrency(row.saldoKemarin)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.debet === 0
                            ? '0,00'
                            : formatAccountingCurrency(row.debet)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.kredit === 0
                            ? '0,00'
                            : formatAccountingCurrency(row.kredit)}
                        </td>
                        <td className="num-col">
                          {isSectionHeader && row.saldoAkhir === 0
                            ? '0,00'
                            : formatAccountingCurrency(row.saldoAkhir)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="formal-report-sign-area">
              <div className="formal-sign-box">
                <div className="formal-sign-role">Diketahui,</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Pimpinan / Direktur SPBU</div>
                <div className="formal-sign-title">PT SPBU Mitra Akrual 1954</div>
              </div>
              <div className="formal-sign-box">
                <div className="formal-sign-role">Pembukuan,</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Bagian Akuntansi & Pajak</div>
                <div className="formal-sign-title">Lubuk Alung</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ARUS KAS */}
      {activeTab === 'arus_kas' && (
        <Card>
          <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                Arus Kas dari Aktivitas Operasi
              </div>
              {reports.arusKas.operasional.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: '13px', borderBottom: '1px solid #F8FAFC' }}>
                  <span>{item.name}</span>
                  <span className="table-num">Rp {item.amount.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                Arus Kas dari Aktivitas Investasi & Pendanaan
              </div>
              {reports.arusKas.investasi.concat(reports.arusKas.pendanaan).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: '13px', borderBottom: '1px solid #F8FAFC' }}>
                  <span>{item.name}</span>
                  <span className="table-num">Rp {item.amount.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontWeight: 700, fontSize: '14px' }}>
              <span>Kas Akhir Periode</span>
              <span className="table-num">Rp 54.820.000</span>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 4: STOK & PENJUALAN BBM */}
      {activeTab === 'stok_penjualan' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Produk</th>
                  <th className="table-num">Stok Awal (L)</th>
                  <th className="table-num">Pembelian DO (L)</th>
                  <th className="table-num">Penjualan Tera (L)</th>
                  <th className="table-num">Stok Akhir (L)</th>
                  <th className="table-num">Kapasitas Tanki (L)</th>
                  <th className="table-num">Level (%)</th>
                </tr>
              </thead>
              <tbody>
                {reports.stokPenjualan.map((row) => (
                  <tr key={row.code}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.code}</td>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td className="table-num">{row.stokAwal.toLocaleString('id-ID')}</td>
                    <td className="table-num">+{row.pembelian.toLocaleString('id-ID')}</td>
                    <td className="table-num">-{row.penjualan.toLocaleString('id-ID')}</td>
                    <td className="table-num" style={{ fontWeight: 600 }}>
                      {row.stokAkhir.toLocaleString('id-ID')}
                    </td>
                    <td className="table-num">{row.kapasitasTanki.toLocaleString('id-ID')}</td>
                    <td className="table-num">{row.persenTerisi}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
