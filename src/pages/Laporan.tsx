import React, { useState, useEffect, useRef, useCallback } from 'react';
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

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function LaporanPage({
  activeSubTab = 'neraca',
  showToast
}: LaporanPageProps) {
  const { reports, stationInfo, refreshReports } = useAppContext();
  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'neraca');

  // Filter Periode State (Tepat 6 Pilihan Standar)
  const [selectedPeriodOption, setSelectedPeriodOption] = useState<string>('Semua Periode');
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayLocalDate());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayLocalDate());
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Pencegah infinite render loop dan duplikasi query saat ganti subtab
  const lastLoadedPeriodRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  const getEffectivePeriod = useCallback((option: string, start: string, end: string): string => {
    if (option === 'Custom' || option === 'Rentang Tanggal Kustom') {
      return `${start} s/d ${end}`;
    }
    return option;
  }, []);

  const loadReports = useCallback(async (periodParam: string, notifySuccess = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setReportError(null);

    try {
      await refreshReports(periodParam);
      lastLoadedPeriodRef.current = periodParam;
      if (notifySuccess) {
        showToast(`Laporan periode ${periodParam} berhasil dimuat.`, 'success');
      }
    } catch (err: any) {
      console.error('[LaporanPage] Gagal memuat data laporan:', err);
      const msg = err?.message || 'Gagal memuat laporan dari SQLite.';
      setReportError(msg);
      showToast(msg, 'danger');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [refreshReports, showToast]);

  // Initial load saat komponen pertama kali terpasang
  useEffect(() => {
    if (selectedPeriodOption === 'Custom' || selectedPeriodOption === 'Rentang Tanggal Kustom') {
      return;
    }
    const periodToLoad = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
    if (lastLoadedPeriodRef.current !== periodToLoad) {
      loadReports(periodToLoad, false);
    }
  }, [loadReports, getEffectivePeriod, selectedPeriodOption, customStartDate, customEndDate]);

  const handleSelectPeriodOption = async (option: string) => {
    setSelectedPeriodOption(option);
    setDateValidationError(null);
    setReportError(null);

    if (option !== 'Custom' && option !== 'Rentang Tanggal Kustom') {
      await loadReports(option, true);
    }
  };

  const handleApplyPeriod = async () => {
    if (selectedPeriodOption === 'Custom' || selectedPeriodOption === 'Rentang Tanggal Kustom') {
      if (customStartDate > customEndDate) {
        const errMsg = `Tanggal mulai (${customStartDate}) tidak boleh melewati tanggal akhir (${customEndDate}).`;
        setDateValidationError(errMsg);
        showToast(errMsg, 'danger');
        return;
      }
    }
    setDateValidationError(null);
    const periodToLoad = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
    await loadReports(periodToLoad, true);
  };

  const handleReset = async () => {
    setSelectedPeriodOption('Semua Periode');
    setCustomStartDate(getTodayLocalDate());
    setCustomEndDate(getTodayLocalDate());
    setDateValidationError(null);
    setReportError(null);
    await loadReports('Semua Periode', true);
  };

  const handleRefresh = async () => {
    const periodToLoad = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
    await loadReports(periodToLoad, true);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const periodLabel = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
      let result;
      if (activeTab === 'neraca') {
        result = await exportNeracaPdf(reports, stationInfo, periodLabel);
      } else if (activeTab === 'laba_rugi') {
        result = await exportLabaRugiPdf(reports, stationInfo, periodLabel);
      } else if (activeTab === 'arus_kas') {
        result = await exportArusKasPdf(reports, stationInfo, periodLabel);
      } else if (activeTab === 'stok_penjualan') {
        result = await exportStokPdf(reports, stationInfo, periodLabel);
      }

      if (result) {
        if (result.cancelled) {
          // Dialog SAF dibatalkan oleh pengguna Android: JANGAN tampilkan notifikasi sukses!
          showToast('Penyimpanan dokumen PDF dibatalkan oleh pengguna.', 'warning');
        } else if (result.success) {
          const isNative = (window as any).Capacitor?.isNativePlatform?.() || false;
          if (isNative) {
            showToast(`Dokumen PDF berhasil disimpan ke perangkat: ${result.filename}`, 'success');
          } else {
            showToast(`Dokumen PDF berhasil diunduh oleh peramban: ${result.filename}`, 'success');
          }
        } else {
          showToast(result.error || 'Gagal mengekspor dokumen PDF.', 'danger');
        }
      }
    } catch (err: any) {
      console.error('[LaporanPage] Export PDF error:', err);
      showToast(err?.message || 'Gagal mengekspor PDF laporan.', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      const periodLabel = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
      if (activeTab === 'neraca') {
        printNeracaReport(reports, stationInfo, periodLabel);
      } else if (activeTab === 'laba_rugi') {
        printLabaRugiReport(reports, stationInfo, periodLabel);
      } else if (activeTab === 'arus_kas') {
        printArusKasReport(reports, stationInfo, periodLabel);
      } else if (activeTab === 'stok_penjualan') {
        printStokReport(reports, stationInfo, periodLabel);
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

  const currentPeriodLabel = getEffectivePeriod(selectedPeriodOption, customStartDate, customEndDate);
  const isCustomRange = selectedPeriodOption === 'Custom' || selectedPeriodOption === 'Rentang Tanggal Kustom';
  const isDateRangeInvalid = isCustomRange && customStartDate > customEndDate;

  // Komponen Toolbar Filter Periode Lengkap (Tepat 6 Opsi Standar)
  const renderPeriodToolbar = (showExportButtons = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Periode:</span>
        <select
          className="form-select"
          style={{ width: '175px', minHeight: '34px', padding: '4px 8px' }}
          value={selectedPeriodOption === 'Rentang Tanggal Kustom' ? 'Custom' : selectedPeriodOption}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSelectPeriodOption(e.target.value)}
          disabled={isLoading}
        >
          <option value="Semua Periode">Semua Periode</option>
          <option value="Hari Ini">Hari Ini</option>
          <option value="7 Hari Terakhir">7 Hari Terakhir</option>
          <option value="Bulan Ini">Bulan Ini</option>
          <option value="Tahun Ini">Tahun Ini</option>
          <option value="Custom">Custom</option>
        </select>

        {isCustomRange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              className="form-control"
              style={{ width: '140px', minHeight: '34px', padding: '3px 8px', fontSize: '12.5px' }}
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              disabled={isLoading}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>s/d</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '140px', minHeight: '34px', padding: '3px 8px', fontSize: '12.5px' }}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleApplyPeriod}
          disabled={isLoading || isDateRangeInvalid}
        >
          {isLoading ? 'Memuat...' : 'Tampilkan'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isLoading}
          title="Reset periode ke Semua Periode"
        >
          Reset
        </Button>

        {showExportButtons && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <Button variant="secondary" size="sm" onClick={handlePrint} disabled={isLoading}>
              Cetak
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={isLoading || isExporting}>
              {isExporting ? 'Mengekspor...' : 'Export PDF'}
            </Button>
          </div>
        )}
      </div>

      {(dateValidationError || isDateRangeInvalid) && (
        <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>
          ⚠️ {dateValidationError || `Tanggal mulai (${customStartDate}) tidak boleh melewati tanggal akhir (${customEndDate}).`}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Banner Error Terkelola Jika Query Database Mengalami Masalah */}
      {reportError && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 14px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--border-radius-sm)',
          color: '#991B1B',
          fontSize: '12.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {reportError}</span>
          <Button variant="danger" size="sm" onClick={handleRefresh} disabled={isLoading}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Page Header khusus untuk laporan Arus Kas & Stok BBM */}
      {activeTab === 'arus_kas' && (
        <PageHeader
          category="Laporan"
          title="Laporan Arus Kas"
          subtitle="Arus kas dari aktivitas operasi, investasi, dan pendanaan"
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handlePrint} disabled={isLoading}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={isLoading || isExporting}>
                {isExporting ? 'Mengekspor...' : 'Export PDF'}
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
              <Button variant="secondary" size="sm" onClick={handlePrint} disabled={isLoading}>
                Cetak
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={isLoading || isExporting}>
                {isExporting ? 'Mengekspor...' : 'Export PDF'}
              </Button>
            </div>
          }
        />
      )}

      {/* Filter Periode Toolbar (tab Arus Kas & Stok) */}
      {activeTab !== 'neraca' && activeTab !== 'laba_rugi' && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            maxWidth: '100%'
          }}
        >
          {renderPeriodToolbar(false)}
        </div>
      )}

      {/* TAB 1: NERACA (LAPORAN RESMI BERBASIS DOKUMEN REFERENSI PDF) */}
      {activeTab === 'neraca' && (
        <div className="report-paper-container">
          {/* Simple Toolbar di luar dokumen laporan */}
          <div className="formal-report-toolbar">
            {renderPeriodToolbar(true)}
          </div>

          {/* Lembar Dokumen Laporan Resmi */}
          <div className="formal-report-paper">
            {/* Header Laporan */}
            <div className="formal-report-header">
              <div className="formal-report-title">
                {reports.neracaKonsolidasi?.title || 'LAPORAN NERACA HARIAN KONSOLIDASI'}
              </div>
              <div className="formal-report-period">
                {reports.neracaKonsolidasi?.periodDate || currentPeriodLabel}
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

            {/* Signature Area: Satu Blok Tanda Tangan Pimpinan di Kanan Bawah */}
            <div className="formal-report-sign-area">
              <div className="formal-sign-box">
                <div className="formal-sign-role">Diketahui, {reports.neracaKonsolidasi?.signerDate || ''}</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">{stationInfo?.manager || 'Direksi / Pimpinan'}</div>
                <div className="formal-sign-title">Pimpinan / Direktur SPBU</div>
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
            {renderPeriodToolbar(true)}
          </div>

          {/* Lembar Dokumen Laporan Resmi */}
          <div className="formal-report-paper">
            {/* Header Laporan */}
            <div className="formal-report-header">
              <div className="formal-report-title">
                {reports.labaRugiKonsolidasi?.title || 'LAPORAN LABA-RUGI KONSOLIDASI HARIAN'}
              </div>
              <div className="formal-report-period">
                {reports.labaRugiKonsolidasi?.periodDate || currentPeriodLabel}
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

            {/* Signature Area: Satu Blok Tanda Tangan Pimpinan di Kanan Bawah */}
            <div className="formal-report-sign-area">
              <div className="formal-sign-box">
                <div className="formal-sign-role">Diketahui, {reports.labaRugiKonsolidasi?.signerDate || ''}</div>
                <div className="formal-sign-line"></div>
                <div className="formal-sign-name">{stationInfo?.manager || 'Direksi / Pimpinan'}</div>
                <div className="formal-sign-title">Pimpinan / Direktur SPBU</div>
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
