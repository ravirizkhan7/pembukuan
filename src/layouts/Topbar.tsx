import React from 'react';
import { Menu, LogOut, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export interface TopbarProps {
  onToggleSidebar: () => void;
  onLogout: () => void;
  activeNav?: string;
  activeSubNav?: string;
  stationId?: string;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  transaksi: 'Transaksi',
  monitoring: 'Monitoring',
  akuntansi: 'Akuntansi',
  laporan: 'Laporan',
  pengaturan: 'Pengaturan'
};

const subPageTitles: Record<string, string> = {
  tera: 'Monitoring Tera',
  tanki: 'Tanki Pendam',
  nozzle: 'Nozzle Dispenser',
  shift: 'Shift Kerja',
  produk: 'Produk BBM',
  master_kode: 'Master Kode',
  akun: 'Bagan Akun (COA)',
  jurnal: 'Jurnal Umum',
  buku_besar: 'Buku Besar',
  buku_bantu: 'Buku Pembantu Piutang & Hutang',
  neraca: 'Neraca',
  laba_rugi: 'Laba Rugi',
  arus_kas: 'Arus Kas',
  stok_penjualan: 'Stok & Penjualan'
};

export function Topbar({
  onToggleSidebar,
  onLogout,
  activeNav = 'dashboard',
  activeSubNav = '',
  stationId
}: TopbarProps) {
  const { activeShift, stationInfo } = useAppContext();
  const pageTitle = pageTitles[activeNav] || 'Pembukuan';
  const subTitle = activeSubNav ? subPageTitles[activeSubNav] : null;
  const currentStationId = stationInfo?.id || stationId || 'SPBU';

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 900,
        boxShadow: '0 1px 2px rgba(3, 4, 94, 0.03)'
      }}
    >
      {/* Top subtle 2px accent indicator */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2.5px',
          background: 'linear-gradient(90deg, var(--blue-900) 0%, var(--blue-700) 45%, var(--blue-500) 80%, var(--blue-300) 100%)'
        }}
        aria-hidden="true"
      />

      {/* Left: Sidebar Toggle + Page Title & Breadcrumb Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn btn-ghost"
          style={{ minHeight: '36px', minWidth: '36px', padding: '6px' }}
          title="Buka / Tutup Navigasi"
          aria-label="Toggle Navigation"
        >
          <Menu size={19} color="var(--color-primary)" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-dark-text)', letterSpacing: '-0.1px' }}>
            {pageTitle}
          </span>
          {subTitle && (
            <>
              <ChevronRight size={14} color="var(--color-muted-text)" />
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-primary)' }}>
                {subTitle}
              </span>
            </>
          )}

          {/* Active Context Badge */}
          <span
            style={{
              marginLeft: '10px',
              padding: '2px 8px',
              borderRadius: 'var(--border-radius-xs)',
              backgroundColor: activeShift ? 'var(--blue-50)' : 'var(--color-surface-subtle)',
              border: `1px solid ${activeShift ? 'var(--blue-200)' : 'var(--color-border)'}`,
              fontSize: '11px',
              fontWeight: 600,
              color: activeShift ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: activeShift ? 'var(--color-primary)' : '#94A3B8'
              }}
              aria-hidden="true"
            />
            {activeShift ? `${activeShift.name} • ${currentStationId}` : `Belum ada shift aktif • ${currentStationId}`}
          </span>
        </div>
      </div>

      {/* Right: Sesi Status & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 10px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border-subtle)',
            fontSize: '12px',
            color: 'var(--color-dark-text)',
            fontWeight: 600
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px #10B981'
            }}
          />
          <span>Sesi Aktif</span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="btn btn-ghost btn-sm"
          style={{
            minHeight: '34px',
            padding: '4px 10px',
            color: 'var(--color-muted-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Keluar"
        >
          <LogOut size={14} />
          <span style={{ fontSize: '12.5px', fontWeight: 500 }}>Logout</span>
        </button>
      </div>
    </header>
  );
}
