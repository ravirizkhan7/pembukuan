import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { StationInfo } from '../types';

export interface AppLayoutProps {
  children: React.ReactNode;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  activeSubNav: string;
  setActiveSubNav: (subNav: string) => void;
  onLogout: () => void;
  stationInfo?: StationInfo;
  stationId?: string;
}

export function AppLayout({
  children,
  activeNav,
  setActiveNav,
  activeSubNav,
  setActiveSubNav,
  onLogout,
  stationInfo,
  stationId
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setIsMobile(true);
        setIsSidebarOpen(false);
      } else {
        setIsMobile(false);
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div className="app-container">
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        activeSubNav={activeSubNav}
        setActiveSubNav={setActiveSubNav}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMobile={isMobile}
        stationInfo={stationInfo}
        onLogout={onLogout}
      />

      <div className="main-wrapper">
        <Topbar
          onToggleSidebar={toggleSidebar}
          onLogout={onLogout}
          activeNav={activeNav}
          activeSubNav={activeSubNav}
          stationId={stationInfo?.id || stationId}
        />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
