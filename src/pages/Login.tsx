import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { StationInfo } from '../types';
import { verifyRecoveryEmail, validatePinFormat } from '../services/appSettings';

export interface LoginPageProps {
  onLogin: () => void;
  authPin: string;
  stationInfo?: StationInfo;
  onResetPin?: (newPin: string) => void;
}

export function LoginPage({ onLogin, authPin, stationInfo, onResetPin }: LoginPageProps) {
  // PIN LOGIN STATE (Kosong secara default, tidak di-hardcode)
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // LUPA PIN MODAL STATE
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // RESET PIN FORM STATE (Step 2 of Recovery)
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinResetError, setPinResetError] = useState('');

  const registeredEmail = stationInfo?.email || 'admin@spbucontoh.co.id';

  // Cooldown countdown timer effect
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginNotice('');

    if (lockoutSeconds > 0) {
      setError(`Akses terkunci sementara karena percobaan berulang. Tunggu ${lockoutSeconds} detik.`);
      return;
    }

    if (!pin) {
      setError('Masukkan PIN untuk melanjutkan');
      return;
    }

    if (pin === authPin) {
      setFailedAttempts(0);
      setError('');
      onLogin();
    } else {
      const nextAttempts = failedAttempts + 1;
      if (nextAttempts >= 5) {
        setLockoutSeconds(30);
        setFailedAttempts(0);
        setError('Terlalu banyak percobaan salah (5x). Akses dikunci sementara selama 30 detik untuk keamanan terminal.');
      } else {
        setFailedAttempts(nextAttempts);
        setError(`PIN tidak valid. Sisa percobaan: ${5 - nextAttempts}x.`);
      }
    }
  };

  // STEP 1: Verifikasi email recovery
  const handleVerifyEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRecoveryError('');

    const res = verifyRecoveryEmail(recoveryEmail, registeredEmail);
    if (!res.matched) {
      setRecoveryError(res.message);
      return;
    }

    setIsEmailVerified(true);
  };

  // STEP 2: Simpan PIN baru setelah email cocok
  const handleResetPinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPinResetError('');

    const pinCheck = validatePinFormat(newPin);
    if (!pinCheck.valid) {
      setPinResetError(pinCheck.message || 'Format PIN tidak valid.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinResetError('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    if (onResetPin) {
      onResetPin(newPin);
    }

    // Reset modal & return to login
    setIsForgotModalOpen(false);
    setIsEmailVerified(false);
    setRecoveryEmail('');
    setNewPin('');
    setConfirmPin('');
    setPin('');
    setError('');
    setFailedAttempts(0);
    setLockoutSeconds(0);
    setLoginNotice('PIN berhasil diperbarui. Silakan masuk menggunakan PIN baru Anda.');
  };

  const handleCloseModal = () => {
    setIsForgotModalOpen(false);
    setIsEmailVerified(false);
    setRecoveryEmail('');
    setRecoveryError('');
    setNewPin('');
    setConfirmPin('');
    setPinResetError('');
  };

  return (
    <div className="login-page-root">
      <div className="login-split-card">
        {/* LEFT AREA: Brand Identity (Blue Palette Gradient + Geometric Ledger Motif) */}
        <div className="login-brand-side">
          {/* Subtle Abstract Ledger / Flow SVG Pattern in Background */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.12,
              pointerEvents: 'none'
            }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 400 500"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="ledgerGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="0.75" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ledgerGrid)" />
            {/* Abstract data flow & precision meter line */}
            <path
              d="M 20 180 L 120 180 L 160 220 L 260 220 L 300 270 L 380 270"
              fill="none"
              stroke="#00B4D8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path
              d="M 20 320 L 100 320 L 150 360 L 280 360 L 380 440"
              fill="none"
              stroke="#48CAE4"
              strokeWidth="1.5"
            />
            {/* Calibration tick marks */}
            <line x1="40" y1="80" x2="60" y2="80" stroke="#CAF0F8" strokeWidth="1" />
            <line x1="40" y1="95" x2="55" y2="95" stroke="#CAF0F8" strokeWidth="1" />
            <line x1="40" y1="110" x2="70" y2="110" stroke="#CAF0F8" strokeWidth="1.5" />
            <line x1="40" y1="125" x2="55" y2="125" stroke="#CAF0F8" strokeWidth="1" />
            <line x1="40" y1="140" x2="60" y2="140" stroke="#CAF0F8" strokeWidth="1" />
          </svg>

          {/* Top Brand Header */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '7px',
                  backgroundColor: 'var(--blue-500)',
                  color: 'var(--blue-900)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '19px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
                }}
              >
                A
              </div>
              <div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '1px',
                    lineHeight: 1.1
                  }}
                >
                  AKRUAL
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--blue-200)',
                    letterSpacing: '0.4px'
                  }}
                >
                  Pembukuan SPBU
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--blue-100)',
                marginTop: '16px',
                lineHeight: 1.5,
                maxWidth: '300px'
              }}
            >
              Sistem pencatatan transaksi kasir, tera nozzle, stok tanki, dan pembukuan akuntansi standar SPBU.
            </div>
          </div>

          {/* Middle: Software Features / Identity points */}
          <div
            className="login-brand-features"
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              margin: '32px 0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--blue-400)',
                  boxShadow: '0 0 6px var(--blue-400)'
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--blue-100)', fontWeight: 500 }}>
                Master Kode Transaksi Terstandar
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--blue-400)',
                  boxShadow: '0 0 6px var(--blue-400)'
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--blue-100)', fontWeight: 500 }}>
                Rekonsiliasi Tera & Jurnal Otomatis
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--blue-400)',
                  boxShadow: '0 0 6px var(--blue-400)'
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--blue-100)', fontWeight: 500 }}>
                Laporan Keuangan & Pengawasan Shift
              </span>
            </div>
          </div>

          {/* Bottom Terminal Status - Menggunakan Identitas SPBU Dinamis */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '11.5px',
              color: 'var(--blue-200)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="var(--blue-400)" />
              <span style={{ fontWeight: 600 }}>{stationInfo?.name || stationInfo?.id || 'Stasiun SPBU Terdaftar'}</span>
            </div>
            <span>Workstation v0.1.0</span>
          </div>
        </div>

        {/* RIGHT AREA: Login Form */}
        <div className="login-form-side">
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              AKRUAL • Pembukuan SPBU
            </div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--color-dark-text)',
                margin: 0,
                letterSpacing: '-0.3px'
              }}
            >
              Masuk ke Sistem
            </h1>
            <p
              className="text-muted"
              style={{
                fontSize: '13px',
                marginTop: '6px',
                margin: '6px 0 0 0'
              }}
            >
              Masukkan PIN untuk membuka sesi kasir & pembukuan.
            </p>
          </div>

          {/* Success / Recovery Notice */}
          {loginNotice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '12.5px',
                fontWeight: 600,
                marginBottom: '16px'
              }}
              role="status"
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{loginNotice}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: 'var(--color-danger-subtle)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
                fontSize: '12.5px',
                fontWeight: 600,
                marginBottom: '16px'
              }}
              role="alert"
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}
              >
                <label className="form-label" htmlFor="user-pin" style={{ margin: 0 }}>
                  PIN AKSES
                </label>
                {/* TOMBOL / LINK LUPA PIN */}
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(true);
                    setIsEmailVerified(false);
                    setRecoveryEmail('');
                    setRecoveryError('');
                    setPinResetError('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  Lupa PIN?
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  id="user-pin"
                  type="password"
                  className="form-control"
                  style={{
                    height: '48px',
                    fontSize: '22px',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: lockoutSeconds > 0 ? 'var(--color-bg-subtle)' : 'var(--color-surface-subtle)',
                    borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
                    boxShadow: error ? '0 0 0 3px rgba(211, 47, 47, 0.15)' : undefined,
                    cursor: lockoutSeconds > 0 ? 'not-allowed' : 'text'
                  }}
                  value={pin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setPin(e.target.value);
                    setError('');
                    setLoginNotice('');
                  }}
                  placeholder={lockoutSeconds > 0 ? `LOCKED` : '••••'}
                  maxLength={6}
                  disabled={lockoutSeconds > 0}
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={lockoutSeconds > 0}
              style={{
                width: '100%',
                minHeight: '46px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: lockoutSeconds > 0 ? 0.7 : 1,
                cursor: lockoutSeconds > 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <span>{lockoutSeconds > 0 ? `Terkunci (${lockoutSeconds}s)` : 'Masuk'}</span>
              <ArrowRight size={16} />
            </Button>
          </form>

          <div
            style={{
              marginTop: '28px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-border-subtle)',
              textAlign: 'center',
              fontSize: '11.5px',
              color: 'var(--color-muted-text)'
            }}
          >
            Khusus Operator & Manajemen SPBU Terotorisasi
          </div>
        </div>
      </div>

      {/* MODAL LUPA PIN (OFFLINE-COMPATIBLE MOCK RECOVERY FLOW) */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={handleCloseModal}
        title="Lupa PIN"
        icon={KeyRound}
      >
        {!isEmailVerified ? (
          /* STEP 1: MASUKKAN EMAIL PEMULIHAN */
          <form onSubmit={handleVerifyEmail}>
            <p style={{ fontSize: '13px', color: 'var(--color-muted-text)', marginBottom: '14px', lineHeight: 1.5 }}>
              Masukkan email pemulihan yang terdaftar pada aplikasi untuk memverifikasi kepemilikan akun instance SPBU ini.
            </p>

            {recoveryError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: 'var(--color-danger-subtle)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px'
                }}
                role="alert"
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{recoveryError}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="recovery-email">
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="recovery-email"
                  type="email"
                  className="form-control"
                  value={recoveryEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setRecoveryEmail(e.target.value);
                    setRecoveryError('');
                  }}
                  placeholder="admin@spbucontoh.co.id"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={handleCloseModal}>
                Batal
              </Button>
              <Button type="submit" variant="primary">
                Verifikasi Email
              </Button>
            </div>
          </form>
        ) : (
          /* STEP 2: RECOVERY PIN (SETELAH EMAIL TERVERIFIKASI) */
          <form onSubmit={handleResetPinSubmit}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '11px 13px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                marginBottom: '16px'
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                  Email terverifikasi. Pemulihan PIN siap dilakukan.
                </div>
                <div style={{ fontSize: '11.5px', marginTop: '2px', color: '#047857' }}>
                  Identitas akun cocok dengan konfigurasi instance SPBU ({stationInfo?.id || 'Lokal'}).
                </div>
              </div>
            </div>

            {pinResetError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: 'var(--color-danger-subtle)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px'
                }}
                role="alert"
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{pinResetError}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="recovery-new-pin">
                PIN Baru
              </label>
              <input
                id="recovery-new-pin"
                type="password"
                className="form-control"
                value={newPin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setNewPin(e.target.value);
                  setPinResetError('');
                }}
                placeholder="••••"
                maxLength={6}
                required
                autoFocus
              />
              <span className="text-muted" style={{ fontSize: '11px', marginTop: '2px', display: 'block' }}>
                4 - 6 digit angka
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="recovery-confirm-pin">
                Konfirmasi PIN Baru
              </label>
              <input
                id="recovery-confirm-pin"
                type="password"
                className="form-control"
                value={confirmPin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setConfirmPin(e.target.value);
                  setPinResetError('');
                }}
                placeholder="••••"
                maxLength={6}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={handleCloseModal}>
                Batal
              </Button>
              <Button type="submit" variant="primary">
                Simpan PIN Baru
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
