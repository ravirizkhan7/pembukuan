import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { TransaksiPage } from './pages/Transaksi';
import { OperasionalPage } from './pages/Operasional';
import { AkuntansiPage } from './pages/Akuntansi';
import { LaporanPage } from './pages/Laporan';
import { PengaturanPage } from './pages/Pengaturan';

import * as mockData from './mock/mockData';
import { ToastMessage, ToastType } from './types';

function AppContent() {
  const { authPin, changePin, stationInfo, updateStationInfo } = useAppContext();
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialLoggedIn = false;
  // const initialLoggedIn = queryParams ? queryParams.get('login') !== '1' : true;
  const initialNav = queryParams ? queryParams.get('nav') || 'dashboard' : 'dashboard';
  const initialSubNav = queryParams ? queryParams.get('sub') || '' : '';

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(initialLoggedIn);
  const [activeNav, setActiveNav] = useState<string>(initialNav);
  const [activeSubNav, setActiveSubNav] = useState<string>(initialSubNav);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: ToastType = 'primary') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setActiveNav('dashboard');
    showToast('Sesi aktif.', 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
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
