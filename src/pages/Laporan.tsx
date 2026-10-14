import React, { useState, useEffect } from 'react';
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
  const { reports, stationInfo, refreshReports } = useAppContext();
  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'neraca');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('31 Agustus 2026');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    refreshReports(selectedPeriod).catch(console.error);
  }, [refreshReports, selectedPeriod]);

  const handlePeriodChange = async (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    setIsLoading(true);
    try {
      await refreshReports(newPeriod);
      showToast(`Laporan periode ${newPeriod} dimuat dari SQLite.`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Gagal memuat laporan untuk periode ${newPeriod}.`, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshReports(selectedPeriod);
      showToast(`Laporan periode ${selectedPeriod} diperbarui.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui laporan.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

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

  // Perhitungan Kas Akhir Periode Arus Kas
  const totalOps = (reports.arusKas?.operasional || []).reduce((s, item) => s + item.amount, 0);
  const totalInvPend = (reports.arusKas?.investasi || []).concat(reports.arusKas?.pendanaan || []).reduce((s, item) => s + item.amount, 0);
  const kasAkhir = (reports.arusKas?.saldoAwal || 0) + totalOps + totalInvPend;

  const renderPeriodSelector = () => (
    <select
      className="form-select"
      style={{ width: '190px', minHeight: '34px', padding: '4px 8px' }}
      value={selectedPeriod}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePeriodChange(e.target.value)}
      disabled={isLoading}
    >
      <option value="31 Agustus 2026">31 Agustus 2026</option>
      <option value="30 September 2026">30 September 2026</option>
      <option value="31 Juli 2026">31 Juli 2026</option>
      <option value="Hari Ini">Hari Ini</option>
      <option value="Bulan Ini">Bulan Ini</option>
      <option value="Tahun 2026">Tahun 2026</option>
      <option value="Semua Periode">Semua Periode</option>
    </select>
  );

  return (
    <div>
      {/* Page Header khusus untuk laporan Arus Kas & Stok BBM */}
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

      {/* Filter Periode Toolbar (tab Arus Kas & Stok) */}
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
          {renderPeriodSelector()}
          <Button variant="primary" size="sm" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? 'Memuat...' : 'Tampilkan'}
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
              {renderPeriodSelector()}
              <Button
                variant="primary"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? 'Memuat...' : 'Tampilkan'}
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
                {reports.neracaKonsolidasi?.periodDate || selectedPeriod}
              </div>
              <div className="formal-report-entity">
                {reports.neracaKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954'}
              </div>
              <div className="formal-report-location">
                {reports.neracaKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung'}
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
                            <span className="neraca-code">[{row.code}] </span>
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

            {/* Audit & Balance Check Warning Banner */}
            {reports.neracaKonsolidasi?.isSeimbang === false && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 'var(--border-radius-sm)',
                color: '#991B1B'
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                  ⚠️ PERINGATAN KESEIMBANGAN: Laporan Neraca Tidak Seimbang
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Total Aset: <strong>Rp {(reports.neracaKonsolidasi.totalAset || 0).toLocaleString('id-ID')}</strong> | Total Kewajiban & Ekuitas (+Laba): <strong>Rp {(reports.neracaKonsolidasi.totalKewajibanDanEkuitas || 0).toLocaleString('id-ID')}</strong>.
                  Terdapat selisih audit sebesar <strong>Rp {(reports.neracaKonsolidasi.selisihKeseimbangan || 0).toLocaleString('id-ID')}</strong>. Sistem tidak merekayasa angka penyeimbang artifisial.
                </div>
              </div>
            )}
            {reports.neracaKonsolidasi?.hasAccountBalanceDiscrepancy && (
              <div style={{
                marginTop: '10px',
                padding: '10px 14px',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 'var(--border-radius-sm)',
                color: '#92400E',
                fontSize: '12px'
              }}>
                ⚠️ <strong>Audit Saldo COA:</strong> Ditemukan ketidakcocokan antara saldo tersimpan di akun buku besar dengan mutasi entri jurnal akuntansi.
              </div>
            )}

            {/* Signature Area */}
            <div className="formal-report-sign-area">
              <div className="formal-sign-box">
                <div className="formal-sign-role">Diketahui {reports.neracaKonsolidasi?.signerDate || ''}</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Direksi / Pimpinan</div>
                <div className="formal-sign-title">{reports.neracaKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954'}</div>
              </div>
              <div className="formal-sign-box">
                <div className="formal-sign-role">Pembukuan</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Bagian Akuntansi & Pelaporan</div>
                <div className="formal-sign-title">{reports.neracaKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung'}</div>
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
              {renderPeriodSelector()}
              <Button
                variant="primary"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? 'Memuat...' : 'Tampilkan'}
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
                {reports.labaRugiKonsolidasi?.periodDate || selectedPeriod}
              </div>
              <div className="formal-report-entity">
                {reports.labaRugiKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954'}
              </div>
              <div className="formal-report-location">
                {reports.labaRugiKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung'}
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
                <div className="formal-sign-title">{reports.labaRugiKonsolidasi?.entityName || stationInfo?.name || 'PT SPBU Mitra Akrual 1954'}</div>
              </div>
              <div className="formal-sign-box">
                <div className="formal-sign-role">Pembukuan,</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">Bagian Akuntansi & Pajak</div>
                <div className="formal-sign-title">{reports.labaRugiKonsolidasi?.location || stationInfo?.address || 'Lubuk Alung'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ARUS KAS */}
      {activeTab === 'arus_kas' && (
        <Card>
          <div style={{ maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '8px', borderBottom: '2px solid var(--color-border)', paddingBottom: '4px', color: 'var(--color-primary-dark)' }}>
                Arus Kas dari Aktivitas Operasi
              </div>
              {reports.arusKas?.operasional.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '13px', borderBottom: '1px solid #F1F5F9' }}>
                  <span>{item.name}</span>
                  <span className="table-num" style={{ fontWeight: 600 }}>
                    {item.amount < 0 ? `(Rp ${Math.abs(item.amount).toLocaleString('id-ID')})` : `Rp ${item.amount.toLocaleString('id-ID')}`}
                  </span>
                </div>
              ))}
              {(!reports.arusKas?.operasional || reports.arusKas.operasional.length === 0) && (
                <div style={{ padding: '8px', fontSize: '13px', color: 'var(--color-muted-text)' }}>Tidak ada mutasi arus kas operasi pada periode ini.</div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '8px', borderBottom: '2px solid var(--color-border)', paddingBottom: '4px', color: 'var(--color-primary-dark)' }}>
                Arus Kas dari Aktivitas Investasi & Pendanaan
              </div>
              {(reports.arusKas?.investasi || []).concat(reports.arusKas?.pendanaan || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '13px', borderBottom: '1px solid #F1F5F9' }}>
                  <span>{item.name}</span>
                  <span className="table-num" style={{ fontWeight: 600 }}>
                    {item.amount < 0 ? `(Rp ${Math.abs(item.amount).toLocaleString('id-ID')})` : `Rp ${item.amount.toLocaleString('id-ID')}`}
                  </span>
                </div>
              ))}
              {((reports.arusKas?.investasi || []).length === 0 && (reports.arusKas?.pendanaan || []).length === 0) && (
                <div style={{ padding: '8px', fontSize: '13px', color: 'var(--color-muted-text)' }}>Tidak ada mutasi investasi atau pendanaan pada periode ini.</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                <span>Kas & Setara Kas Akhir Periode</span>
                <span className="table-num" style={{ color: 'var(--color-primary-dark)' }}>
                  Rp {kasAkhir.toLocaleString('id-ID')}
                </span>
              </div>
              {(reports.arusKas?.saldoAkhirKasFisik !== undefined || reports.arusKas?.saldoAkhirBank !== undefined) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-muted-text)', borderTop: '1px dashed var(--color-border)', paddingTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <span>• Kas Utama (Brankas Fisik): <strong>Rp {(reports.arusKas.saldoAkhirKasFisik || 0).toLocaleString('id-ID')}</strong></span>
                  <span>• Rekening Bank Mandiri: <strong>Rp {(reports.arusKas.saldoAkhirBank || 0).toLocaleString('id-ID')}</strong></span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 4: STOK & PENJUALAN BBM */}
      {activeTab === 'stok_penjualan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* TABEL STOK BBM */}
          <Card
            title="Rekapitulasi Persediaan Stok BBM (Tanki & Nozzle)"
            subtitle="Mutasi kartu stok otomatis dan HPP periodik masih ditunda. Kolom 'Estimasi Stok Berjalan' dihitung berdasarkan akumulasi transaksi penerimaan dan penjualan yang tercatat di database, bukan hasil pengukuran fisik dipping/sounding tanki."
          >
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Produk</th>
                    <th className="table-num">Stok Awal Tangki (L)</th>
                    <th className="table-num">Pembelian DO (L)</th>
                    <th className="table-num">Penjualan Tera (L)</th>
                    <th className="table-num">Estimasi Stok Berjalan (L)*</th>
                    <th className="table-num">Kapasitas Tanki (L)</th>
                    <th className="table-num">Estimasi Level (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports.stokPenjualan || []).map((row) => (
                    <tr key={row.code}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.code}</td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td className="table-num">{row.stokAwal.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ color: '#166534' }}>+{row.pembelian.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ color: 'var(--color-primary-dark)' }}>-{row.penjualan.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ fontWeight: 700 }}>
                        {row.stokAkhir.toLocaleString('id-ID')}
                      </td>
                      <td className="table-num">{row.kapasitasTanki.toLocaleString('id-ID')}</td>
                      <td className="table-num">
                        {row.kapasitasTanki > 0 ? (
                          <span style={{ fontWeight: 600, color: row.persenTerisi < 20 ? 'var(--color-danger)' : undefined }}>
                            {row.persenTerisi}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-muted-text)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!reports.stokPenjualan || reports.stokPenjualan.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted-text)', padding: '20px' }}>
                        Tidak ada data produk/tanki di database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--color-muted-text)', fontStyle: 'italic' }}>
              *Catatan: Nilai persediaan adalah estimasi mutasi transaksi tercatat dan belum divalidasi oleh pengukuran fisik dipping/sounding tanki.
            </div>
          </Card>

          {/* TABEL REKAPITULASI PENJUALAN & SHIFT OPERASIONAL */}
          <Card
            title="Rekapitulasi Penjualan & Sesi Shift Operasional"
            subtitle="Ringkasan penerimaan penjualan aktual berdasarkan metode pembayaran dan sesi shift dari SQLite"
          >
            {/* Metrik Metode Pembayaran */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--blue-50)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--blue-200)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-primary-dark)', fontWeight: 600 }}>Total Penjualan Kotor</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: '4px' }}>
                  Rp {(reports.salesAndShiftRecap?.totalGrossSales || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#F0FDF4', borderRadius: 'var(--border-radius-sm)', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Penerimaan Kas Fisik (Tunai)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                  Rp {(reports.salesAndShiftRecap?.cashSales || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: 'var(--border-radius-sm)', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>Penjualan Kredit (Piutang)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>
                  Rp {(reports.salesAndShiftRecap?.creditSales || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#EDE9FE', borderRadius: 'var(--border-radius-sm)', border: '1px solid #DDD6FE' }}>
                <div style={{ fontSize: '12px', color: '#5B21B6', fontWeight: 600 }}>Penjualan Transfer / Bank</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#5B21B6', marginTop: '4px' }}>
                  Rp {(reports.salesAndShiftRecap?.transferSales || 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Tabel Rekap Shift */}
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Shift ID</th>
                    <th>Nama Shift</th>
                    <th>Kasir</th>
                    <th className="table-num">Modal Awal</th>
                    <th className="table-num">Total Penjualan</th>
                    <th className="table-num">Penjualan Tunai</th>
                    <th className="table-num">Piutang / Transfer</th>
                    <th className="table-num">Setoran Fisik</th>
                    <th className="table-num">Selisih Kas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports.salesAndShiftRecap?.shifts || []).map((s) => (
                    <tr key={s.shiftId}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.shiftId}</td>
                      <td style={{ fontWeight: 600 }}>{s.shiftName}</td>
                      <td>{s.operator}</td>
                      <td className="table-num">Rp {s.initialCash.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ fontWeight: 700 }}>Rp {s.totalSales.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ color: '#166534', fontWeight: 600 }}>Rp {s.cashSales.toLocaleString('id-ID')}</td>
                      <td className="table-num">Rp {(s.creditSales + s.transferSales).toLocaleString('id-ID')}</td>
                      <td className="table-num">{s.cashHandover > 0 ? `Rp ${s.cashHandover.toLocaleString('id-ID')}` : '-'}</td>
                      <td className="table-num" style={{ fontWeight: 600, color: s.discrepancy && s.discrepancy < 0 ? 'var(--color-danger)' : undefined }}>
                        {s.discrepancy !== undefined ? `Rp ${s.discrepancy.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'Aktif' ? 'badge-primary' : 'badge-neutral'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reports.salesAndShiftRecap?.shifts || reports.salesAndShiftRecap.shifts.length === 0) && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-muted-text)', padding: '24px' }}>
                        Belum ada data sesi shift yang tercatat di database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
