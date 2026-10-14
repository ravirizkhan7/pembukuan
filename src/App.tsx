import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { TransaksiPage } from './pages/Transaksi';
import { OperasionalPage } from './pages/Operasional';
import { AkuntansiPage } from './pages/Akuntansi';
import { LaporanPage } from './pages/Laporan';
import { PengaturanPage } from './pages/Pengaturan';
import { PegawaiPage } from './pages/Pegawai';

import * as mockData from './mock/mockData';
import { ToastMessage, ToastType } from './types';
import { AppMetadataService } from './services/database';

// Storage keys for session and navigation
const SESSION_AUTH_KEY = 'akrual_session_active';
const SESSION_NAV_KEY = 'akrual_active_nav';
const SESSION_SUB_NAV_KEY = 'akrual_active_sub_nav';

// Valid navigation structure mapping for safe fallback
const VALID_NAV_CONFIG: Record<string, string[]> = {
  dashboard: [],
  transaksi: [],
  pegawai: ['daftar_pegawai', 'absensi', 'shift_kerja'],
  monitoring: ['tera', 'tanki', 'nozzle', 'produk'],
  akuntansi: ['master_kode', 'akun', 'jurnal', 'buku_besar', 'buku_bantu'],
  laporan: ['neraca', 'laba_rugi', 'arus_kas', 'stok_penjualan'],
  pengaturan: []
};

function getInitialAuthState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

function getInitialNavState(): { nav: string; subNav: string } {
  const defaultNav = { nav: 'dashboard', subNav: '' };
  if (typeof window === 'undefined') return defaultNav;

  try {
    const queryParams = new URLSearchParams(window.location.search);
    const queryNav = queryParams.get('nav');
    const querySubNav = queryParams.get('sub');

    const savedNav = sessionStorage.getItem(SESSION_NAV_KEY);
    const savedSubNav = sessionStorage.getItem(SESSION_SUB_NAV_KEY) || '';

    // Prioritaskan parameter query jika ada, fallback ke sessionStorage
    const targetNav = queryNav || savedNav;
    const targetSubNav = (queryNav ? querySubNav : savedSubNav) || '';

    if (targetNav && VALID_NAV_CONFIG[targetNav]) {
      const allowedSubs = VALID_NAV_CONFIG[targetNav];
      if (allowedSubs.length > 0) {
        if (targetSubNav && allowedSubs.includes(targetSubNav)) {
          return { nav: targetNav, subNav: targetSubNav };
        }
        return { nav: targetNav, subNav: allowedSubs[0] };
      }
      return { nav: targetNav, subNav: '' };
    }
  } catch {
    // fallback jika storage error
  }

  return defaultNav;
}

function AppContent() {
  const { authPin, changePin, stationInfo, updateStationInfo } = useAppContext();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(getInitialAuthState);
  const [activeNav, setActiveNav] = useState<string>(() => getInitialNavState().nav);
  const [activeSubNav, setActiveSubNav] = useState<string>(() => getInitialNavState().subNav);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Sinkronisasi navigasi ke sessionStorage ketika navigasi berubah saat login aktif
  useEffect(() => {
    if (isLoggedIn) {
      try {
        sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
        sessionStorage.setItem(SESSION_NAV_KEY, activeNav);
        sessionStorage.setItem(SESSION_SUB_NAV_KEY, activeSubNav);
      } catch (err) {
        console.error('Failed to sync session navigation:', err);
      }
    }
  }, [isLoggedIn, activeNav, activeSubNav]);

  // Inisialisasi database SQLite dan diagnosa koneksi di background saat app dimuat
  useEffect(() => {
    AppMetadataService.runDiagnostics().catch((err) => {
      console.warn('[App] SQLite auto-diagnostics error:', err);
    });
  }, []);

  const showToast = (message: string, type: ToastType = 'primary') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setActiveNav('dashboard');
    setActiveSubNav('');
    try {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
      sessionStorage.setItem(SESSION_NAV_KEY, 'dashboard');
      sessionStorage.setItem(SESSION_SUB_NAV_KEY, '');
    } catch (err) {
      console.error('Failed to save session on login:', err);
    }
    showToast('Sesi aktif.', 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveNav('dashboard');
    setActiveSubNav('');
    try {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      sessionStorage.removeItem(SESSION_NAV_KEY);
      sessionStorage.removeItem(SESSION_SUB_NAV_KEY);
    } catch (err) {
      console.error('Failed to remove session on logout:', err);
    }
    showToast('Sesi telah keluar.', 'primary');
  };

  const handleNavigate = (navId: string, subNavId: string = '') => {
    setActiveNav(navId);
    setActiveSubNav(subNavId);
  };

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={handleLogin}
        authPin={authPin}
        stationInfo={stationInfo}
        onResetPin={changePin}
      />
    );
  }

  return (
    <>
      <AppLayout
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        activeSubNav={activeSubNav}
        setActiveSubNav={setActiveSubNav}
        onLogout={handleLogout}
        stationInfo={stationInfo}
      >
        {activeNav === 'dashboard' && (
          <DashboardPage
            mockData={mockData}
            stationInfo={stationInfo}
            onNavigate={handleNavigate}
          />
        )}

        {activeNav === 'transaksi' && (
          <TransaksiPage
            mockData={mockData}
            stationInfo={stationInfo}
            showToast={showToast}
          />
        )}

        {activeNav === 'monitoring' && (
          <OperasionalPage
            mockData={mockData}
            activeSubTab={activeSubNav || 'tera'}
            onSubTabChange={(sub) => setActiveSubNav(sub)}
            showToast={showToast}
          />
        )}

        {activeNav === 'pegawai' && (
          <PegawaiPage
            activeSubTab={activeSubNav || 'daftar_pegawai'}
            onSubTabChange={(sub) => setActiveSubNav(sub)}
            showToast={showToast}
          />
        )}

        {activeNav === 'akuntansi' && (
          <AkuntansiPage
            mockData={mockData}
            activeSubTab={activeSubNav || 'master_kode'}
            onSubTabChange={(sub) => setActiveSubNav(sub)}
            showToast={showToast}
          />
        )}

        {activeNav === 'laporan' && (
          <LaporanPage
            mockData={mockData}
            activeSubTab={activeSubNav || 'neraca'}
            onSubTabChange={(sub) => setActiveSubNav(sub)}
            showToast={showToast}
          />
        )}

        {activeNav === 'pengaturan' && (
          <PengaturanPage
            stationInfo={stationInfo}
            onUpdateStationInfo={updateStationInfo}
            currentPin={authPin}
            onChangePin={changePin}
            showToast={showToast}
          />
        )}
      </AppLayout>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-dark-text)' }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
