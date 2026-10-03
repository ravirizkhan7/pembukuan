import React, { useState } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Gauge,
  BookOpen,
  FileSpreadsheet,
  Settings,
  UserCheck,
  ChevronDown,
  ChevronRight,
  X,
  LucideIcon
} from 'lucide-react';
import { StationInfo } from '../types';

export interface SidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  activeSubNav: string;
  setActiveSubNav: (subNav: string) => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  stationInfo?: StationInfo;
}

interface SubNavItem {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  hasSub: boolean;
  subItems?: SubNavItem[];
}

export function Sidebar({
  activeNav,
  setActiveNav,
  activeSubNav,
  setActiveSubNav,
  isOpen,
  setIsOpen,
  isMobile,
  stationInfo,
}: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    monitoring: true,
    akuntansi: true,
    laporan: true
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      hasSub: false
    },
    {
      id: 'transaksi',
      label: 'Transaksi',
      icon: ReceiptText,
      hasSub: false
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      icon: Gauge,
      hasSub: true,
      subItems: [
        { id: 'tera', label: 'Monitoring Tera' },
        { id: 'tanki', label: 'Tanki Pendam' },
        { id: 'nozzle', label: 'Nozzle Dispenser' },
        { id: 'shift', label: 'Shift Kerja' },
        { id: 'produk', label: 'Produk BBM' }
      ]
    },
    {
      id: 'absensi',
      label: 'Absensi',
      icon: UserCheck,
      hasSub: false
    },
    {
      id: 'akuntansi',
      label: 'Akuntansi',
      icon: BookOpen,
      hasSub: true,
      subItems: [
        { id: 'master_kode', label: 'Master Kode' },
        { id: 'akun', label: 'Bagan Akun (COA)' },
        { id: 'jurnal', label: 'Jurnal Umum' },
        { id: 'buku_besar', label: 'Buku Besar' },
        { id: 'buku_bantu', label: 'Piutang & Hutang' }
      ]
    },
    {
      id: 'laporan',
      label: 'Laporan',
      icon: FileSpreadsheet,
      hasSub: true,
      subItems: [
        { id: 'neraca', label: 'Neraca' },
        { id: 'laba_rugi', label: 'Laba Rugi' },
        { id: 'arus_kas', label: 'Arus Kas' },
        { id: 'stok_penjualan', label: 'Stok & Penjualan' }
      ]
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      icon: Settings,
      hasSub: false
    }
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.hasSub) {
      toggleGroup(item.id);
      setActiveNav(item.id);
      if (item.subItems && item.subItems.length > 0) {
        setActiveSubNav(item.subItems[0].id);
      }
    } else {
      setActiveNav(item.id);
      setActiveSubNav('');
      if (isMobile) {
        setIsOpen(false);
      }
    }
  };

  const handleSubNavClick = (parentId: string, subId: string) => {
    setActiveNav(parentId);
    setActiveSubNav(subId);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {isMobile && isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 4, 94, 0.45)',
            zIndex: 998
          }}
        />
      )}

      <aside
        style={{
          width: isOpen ? '248px' : '0px',
          minWidth: isOpen ? '248px' : '0px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          zIndex: 999,
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          boxShadow: '1px 0 3px rgba(3, 4, 94, 0.04)'
        }}
      >
        {/* Brand Header with Rich Blue Identity (OPTION A) */}
        <div
          style={{
            height: '62px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: 'linear-gradient(135deg, var(--blue-900) 0%, var(--blue-800) 65%, var(--blue-700) 100%)',
            borderBottom: '1px solid var(--blue-800)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '5px',
                backgroundColor: 'var(--blue-500)',
                color: 'var(--blue-900)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '15px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#FFFFFF', letterSpacing: '0.6px', lineHeight: 1.1 }}>
                AKRUAL
              </div>
              <div style={{ fontSize: '11px', color: 'var(--blue-200)', fontWeight: 500, letterSpacing: '0.2px' }}>
                Pembukuan SPBU
              </div>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: '34px', minWidth: '34px', padding: '4px', color: '#FFFFFF' }}
              aria-label="Tutup Menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const isExpanded = !!expandedGroups[item.id];

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item)}
                  style={{
                    width: '100%',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    borderLeft: isActive ? '3.5px solid var(--color-primary)' : '3.5px solid transparent',
                    backgroundColor: isActive
                      ? item.hasSub
                        ? 'var(--blue-50)'
                        : 'var(--color-primary-light)'
                      : 'transparent',
                    color: isActive ? 'var(--color-primary-dark)' : 'var(--color-dark-text)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--color-dark-text)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={16} color={isActive ? 'var(--color-primary)' : 'var(--color-muted-text)'} />
                    <span>{item.label}</span>
                  </div>
                  {item.hasSub && (
                    <div style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted-text)' }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  )}
                </button>

                {/* Submenu with Subtle Blue Section Track */}
                {item.hasSub && isExpanded && item.subItems && (
                  <div
                    style={{
                      margin: '2px 0 4px 24px',
                      paddingLeft: '6px',
                      borderLeft: '2px solid var(--blue-200)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1px'
                    }}
                  >
                    {item.subItems.map((sub) => {
                      const isSubActive = activeNav === item.id && activeSubNav === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubNavClick(item.id, sub.id)}
                          style={{
                            width: '100%',
                            minHeight: '33px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            borderRadius: 'var(--border-radius-xs)',
                            border: 'none',
                            backgroundColor: isSubActive ? 'var(--color-primary-light)' : 'transparent',
                            color: isSubActive ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
                            fontWeight: isSubActive ? 700 : 400,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.1s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.backgroundColor = 'var(--blue-50)';
                              e.currentTarget.style.color = 'var(--color-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--color-muted-text)';
                            }
                          }}
                        >
                          {isSubActive && (
                            <span
                              style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-primary)',
                                flexShrink: 0
                              }}
                            />
                          )}
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: Admin  */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-dark-text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {stationInfo?.name || 'SPBU Terdaftar'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted-text)', marginTop: '1px' }}>
              Terminal Kasir & Akuntansi
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}
