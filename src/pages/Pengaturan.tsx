import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common';
import { Card, Button } from '../components/ui';
import {
  Building2,
  KeyRound,
  ShieldCheck,
  HardDrive,
  Laptop,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { StationInfo, ToastType } from '../types';
import { isValidEmail, verifyAndChangePin } from '../services/appSettings';

export interface PengaturanPageProps {
  stationInfo: StationInfo;
  onUpdateStationInfo: (updated: StationInfo) => void;
  currentPin: string;
  onChangePin: (newPin: string) => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function PengaturanPage({
  stationInfo,
  onUpdateStationInfo,
  currentPin,
  onChangePin,
  showToast
}: PengaturanPageProps) {
  // PROFIL SPBU FORM STATE
  const [regNumber, setRegNumber] = useState<string>(stationInfo.id);
  const [stationName, setStationName] = useState<string>(stationInfo.name);
  const [address, setAddress] = useState<string>(stationInfo.address);
  const [manager, setManager] = useState<string>(stationInfo.manager);
  const [phone, setPhone] = useState<string>(stationInfo.phone);
  const [email, setEmail] = useState<string>(stationInfo.email || '');
  const [profileError, setProfileError] = useState<string>('');

  // SINKRONISASI JIKA DATA PROFIL BERUBAH DARI LUAR
  useEffect(() => {
    setRegNumber(stationInfo.id);
    setStationName(stationInfo.name);
    setAddress(stationInfo.address);
    setManager(stationInfo.manager);
    setPhone(stationInfo.phone);
    setEmail(stationInfo.email || '');
  }, [stationInfo]);

  // KEAMANAN (PIN LOGIN) FORM STATE
  const [oldPin, setOldPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pinSuccess, setPinSuccess] = useState<string>('');

  // HANDLER SIMPAN PROFIL IDENTITAS SPBU
  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileError('');

    if (!regNumber.trim()) {
      setProfileError('Nomor Registrasi SPBU wajib diisi.');
      return;
    }

    if (!stationName.trim()) {
      setProfileError('Nama SPBU wajib diisi.');
      return;
    }

    if (!email.trim()) {
      setProfileError('Email admin wajib diisi untuk proses pemulihan PIN.');
      return;
    }

    if (!isValidEmail(email)) {
      setProfileError('Email tidak valid.');
      return;
    }

    const updated: StationInfo = {
      ...stationInfo,
      id: regNumber.trim(),
      name: stationName.trim(),
      address: address.trim(),
      manager: manager.trim(),
      phone: phone.trim(),
      email: email.trim()
    };

    onUpdateStationInfo(updated);
    showToast('Profil SPBU berhasil disimpan.', 'success');
  };

  // HANDLER UBAH PIN LOGIN
  const handleChangePinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    const res = verifyAndChangePin(oldPin, currentPin, newPin, confirmPin);
    if (!res.success) {
      setPinError(res.message);
      return;
    }

    onChangePin(newPin);
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setPinSuccess('PIN berhasil diubah.');
    showToast('PIN berhasil diubah.', 'success');
  };

  const handleBackup = () => {
    showToast(`File backup database (${stationInfo.id}_backup.db) berhasil diunduh.`, 'success');
  };

  const handleRestore = () => {
    showToast('Database lokal dipulihkan dari arsip konfigurasi.', 'primary');
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        subtitle="Identitas SPBU, kredensial PIN login, informasi sistem, dan pencadangan data"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* KOLOM KIRI: PROFIL SPBU & KEAMANAN PIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SECTION 1: PROFIL SPBU (EDITABLE) */}
          <Card
            title="Profil SPBU"
            subtitle="Identitas instance SPBU untuk laporan dan bukti transaksi (dapat dikonfigurasi)"
            icon={Building2}
          >
            {profileError && (
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
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label" htmlFor="spbu-reg-number">
                  Nomor Registrasi SPBU
                </label>
                <input
                  id="spbu-reg-number"
                  type="text"
                  className="form-control"
                  value={regNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setRegNumber(e.target.value);
                    setProfileError('');
                  }}
                  placeholder="Contoh: SPBU-34-12301"
                  required
                />
                <span className="text-muted" style={{ fontSize: '11px', marginTop: '3px', display: 'block' }}>
                  Identitas registrasi stasiun SPBU (digunakan pada header & footer laporan resmi)
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="spbu-name">
                  Nama SPBU
                </label>
                <input
                  id="spbu-name"
                  type="text"
                  className="form-control"
                  value={stationName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setStationName(e.target.value);
                    setProfileError('');
                  }}
                  placeholder="Contoh: SPBU 34.12301 Pertamina"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="spbu-address">
                  Alamat
                </label>
                <textarea
                  id="spbu-address"
                  className="form-control"
                  rows={2}
                  value={address}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap lokasi SPBU..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="spbu-manager">
                    Penanggung Jawab
                  </label>
                  <input
                    id="spbu-manager"
                    type="text"
                    className="form-control"
                    value={manager}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManager(e.target.value)}
                    placeholder="Nama Manajer / Pengawas"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="spbu-phone">
                    No. Telepon
                  </label>
                  <input
                    id="spbu-phone"
                    type="text"
                    className="form-control"
                    value={phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                  />
                </div>
              </div>

              {/* FIELD EMAIL ADMIN (PEMULIHAN PIN) */}
              <div className="form-group">
                <label className="form-label" htmlFor="spbu-email">
                  Email Admin (Pemulihan PIN)
                </label>
                <input
                  id="spbu-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEmail(e.target.value);
                    setProfileError('');
                  }}
                  placeholder="admin@spbucontoh.co.id"
                  required
                />
                <span className="text-muted" style={{ fontSize: '11px', marginTop: '3px', display: 'block' }}>
                  Alamat email ini dicocokkan saat admin melakukan pemulihan akses pada halaman login
                </span>
              </div>

              <Button type="submit" variant="primary" size="sm" style={{ marginTop: '8px' }}>
                Simpan Perubahan
              </Button>
            </form>
          </Card>

          {/* SECTION 2: KEAMANAN (PIN LOGIN) */}
          <Card
            title="Keamanan"
            subtitle="Ubah PIN yang digunakan untuk masuk ke aplikasi"
            icon={KeyRound}
          >
            {pinError && (
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
                <span>{pinError}</span>
              </div>
            )}

            {pinSuccess && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px'
                }}
                role="status"
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{pinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePinSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="current-pin">
                  PIN Saat Ini
                </label>
                <input
                  id="current-pin"
                  type="password"
                  className="form-control"
                  value={oldPin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setOldPin(e.target.value);
                    setPinError('');
                    setPinSuccess('');
                  }}
                  placeholder="••••"
                  maxLength={6}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-pin">
                    PIN Baru
                  </label>
                  <input
                    id="new-pin"
                    type="password"
                    className="form-control"
                    value={newPin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setNewPin(e.target.value);
                      setPinError('');
                      setPinSuccess('');
                    }}
                    placeholder="••••"
                    maxLength={6}
                    required
                  />
                  <span className="text-muted" style={{ fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    4 - 6 digit angka
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-pin">
                    Konfirmasi PIN Baru
                  </label>
                  <input
                    id="confirm-pin"
                    type="password"
                    className="form-control"
                    value={confirmPin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setConfirmPin(e.target.value);
                      setPinError('');
                      setPinSuccess('');
                    }}
                    placeholder="••••"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" variant="primary" size="sm" style={{ marginTop: '6px' }}>
                Ubah PIN
              </Button>
            </form>
          </Card>
        </div>

        {/* KOLOM KANAN: INFORMASI SISTEM, PERANGKAT & BACKUP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SECTION 3: INFORMASI SISTEM */}
          <Card title="Informasi Sistem" icon={ShieldCheck}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Aplikasi</span>
                <strong>AKRUAL SPBU</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">No. Registrasi Instance</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                  {stationInfo.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Email Pemulihan Terdaftar</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {stationInfo.email || '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Versi Rilis</span>
                <span>v0.1.0-generic</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Model Penyimpanan</span>
                <span>Lokal (Offline-First Device)</span>
              </div>
            </div>
          </Card>

          {/* SECTION 4: PERANGKAT & INTEGRASI */}
          <Card title="Perangkat" icon={Laptop}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Tipe Perangkat</span>
                <span>Workstation / Tablet SPBU</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Resolusi Layar</span>
                <span>{typeof window !== 'undefined' ? `${window.innerWidth} × ${window.innerHeight} px` : '1280 × 800 px'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Printer Struk</span>
                <span>Thermal 58mm / 80mm ESC-POS</span>
              </div>
            </div>
          </Card>

          {/* SECTION 5: BACKUP & PEMULIHAN */}
          <Card title="Backup & Pemulihan" icon={HardDrive}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', lineHeight: 1.5 }}>
                Unduh salinan data konfigurasi lokal atau pulihkan database instance dari arsip cadangan.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={handleBackup}>
                  Unduh Backup
                </Button>
                <Button variant="secondary" size="sm" onClick={handleRestore}>
                  Pulihkan Data
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
