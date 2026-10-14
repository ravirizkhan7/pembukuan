import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common';
import { Card, Button, Modal } from '../components/ui';
import {
  Building2,
  KeyRound,
  ShieldCheck,
  HardDrive,
  Laptop,
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { StationInfo, ToastType } from '../types';
import { isValidEmail, verifyAndChangePin } from '../services/appSettings';
import {
  AppMetadataService,
  DatabaseDiagnosticsResult,
  BackupRestoreService,
  PlatformStorageAdapter,
  SpbuBackupFile,
  BackupValidationResult
} from '../services/database';
import { useAppContext } from '../context/AppContext';

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
  const [dbDiag, setDbDiag] = useState<DatabaseDiagnosticsResult | null>(null);

  // SINKRONISASI JIKA DATA PROFIL BERUBAH DARI LUAR
  useEffect(() => {
    setRegNumber(stationInfo.id);
    setStationName(stationInfo.name);
    setAddress(stationInfo.address);
    setManager(stationInfo.manager);
    setPhone(stationInfo.phone);
    setEmail(stationInfo.email || '');
  }, [stationInfo]);

  // LOAD DIAGNOSTIK DATABASE SQLITE
  useEffect(() => {
    AppMetadataService.runDiagnostics()
      .then((res) => setDbDiag(res))
      .catch((err) => console.warn('[Pengaturan] Failed to load db diagnostics:', err));
  }, []);

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

  const { reloadFromDatabase } = useAppContext();

  // BACKUP & RESTORE STATE
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState<boolean>(false);
  const [pendingBackupFile, setPendingBackupFile] = useState<SpbuBackupFile | null>(null);
  const [pendingValidation, setPendingValidation] = useState<BackupValidationResult | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');
  const [lastBackupTime, setLastBackupTime] = useState<string>(stationInfo.lastBackup || '');

  // HANDLER BUAT & UNDUH BACKUP
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await BackupRestoreService.createAndDownloadBackup(stationInfo);
      if (res.cancelled) {
        showToast('Penyimpanan berkas cadangan dibatalkan.', 'primary');
        return;
      }
      const now = new Date().toISOString();
      setLastBackupTime(now);
      showToast(`Berkas cadangan (${res.filename}) berhasil disimpan (${res.totalRecords} baris data).`, 'success');
    } catch (err: any) {
      console.error('[Pengaturan] Backup error:', err);
      showToast(`Gagal membuat cadangan database: ${err.message || String(err)}`, 'danger');
    } finally {
      setIsBackingUp(false);
    }
  };

  // HANDLER PILIH BERKAS & VALIDASI AWAL SEBELUM RESTORE
  const handleStartRestore = async () => {
    try {
      const picked = await PlatformStorageAdapter.pickBackupFile();
      if (!picked) return; // user membatalkan pemilihan file

      const validation = BackupRestoreService.validateBackup(picked.content);
      if (!validation.valid || !validation.metadata) {
        showToast(`Validasi berkas cadangan gagal: ${validation.error || 'Berkas tidak valid'}`, 'danger');
        return;
      }

      const parsed = JSON.parse(picked.content) as SpbuBackupFile;
      setPendingBackupFile(parsed);
      setPendingValidation(validation);
      setPendingFilename(picked.filename);
      setRestoreModalOpen(true);
    } catch (err: any) {
      console.error('[Pengaturan] Start restore error:', err);
      showToast(`Gagal memproses berkas cadangan: ${err.message || String(err)}`, 'danger');
    }
  };

  // HANDLER KONFIRMASI RESTORE ATOMIK
  const handleConfirmRestore = async () => {
    if (!pendingBackupFile) return;
    setIsRestoring(true);
    try {
      const res = await BackupRestoreService.restoreBackup(pendingBackupFile);
      if (reloadFromDatabase) {
        await reloadFromDatabase();
      }
      AppMetadataService.runDiagnostics()
        .then((resDiag) => setDbDiag(resDiag))
        .catch(() => {});

      setRestoreModalOpen(false);
      setPendingBackupFile(null);
      setPendingValidation(null);
      showToast(res.message, 'success');
    } catch (err: any) {
      console.error('[Pengaturan] Confirm restore error:', err);
      setRestoreModalOpen(false);
      showToast(`Pemulihan database gagal: ${err.message || String(err)}. Data sebelumnya tetap aman.`, 'danger');
    } finally {
      setIsRestoring(false);
    }
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
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Model Penyimpanan</span>
                <span>Lokal (Offline-First Device)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Database Engine</span>
                <span style={{ fontWeight: 600 }}>
                  {dbDiag ? `SQLite ${dbDiag.isNative ? 'Native (Android)' : 'Web'} (v${dbDiag.sqliteVersion})` : 'SQLite Memuat...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">ID Instalasi Database</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  {dbDiag?.installationId || '-'}
                </span>
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
          <Card title="Backup & Pemulihan Database" icon={HardDrive}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', lineHeight: 1.5 }}>
                Ekspor seluruh data persisten SQLite (Master Data, COA, Pegawai, Sesi Shift, Absensi, Transaksi, Tera, Jurnal, dan Piutang/Hutang) ke arsip berkas JSON terenkapsulasi dengan hash integritas data (SHA-256), atau pulihkan instance SPBU dari arsip cadangan terverifikasi.
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Database Aktif:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>akrual_spbu (v4)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Cadangan Terakhir:</span>
                  <span style={{ fontWeight: 600 }}>
                    {lastBackupTime ? new Date(lastBackupTime).toLocaleString('id-ID') : 'Belum pernah dicadangkan'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={handleBackup}
                  disabled={isBackingUp || isRestoring}
                >
                  {isBackingUp ? 'Membuat Backup...' : 'Unduh Backup'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  onClick={handleStartRestore}
                  disabled={isBackingUp || isRestoring}
                >
                  {isRestoring ? 'Memulihkan...' : 'Pulihkan Data'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL KONFIRMASI PEMULIHAN (RESTORE) DATABASE */}
      <Modal
        isOpen={restoreModalOpen}
        onClose={() => {
          if (!isRestoring) {
            setRestoreModalOpen(false);
            setPendingBackupFile(null);
            setPendingValidation(null);
          }
        }}
        title="Konfirmasi Pemulihan Database"
        icon={AlertTriangle}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRestoreModalOpen(false);
                setPendingBackupFile(null);
                setPendingValidation(null);
              }}
              disabled={isRestoring}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={isRestoring ? RefreshCw : Upload}
              onClick={handleConfirmRestore}
              disabled={isRestoring}
            >
              {isRestoring ? 'Memproses Pemulihan...' : 'Ya, Timpa & Pulihkan Database'}
            </Button>
          </div>
        }
      >
        {pendingValidation?.metadata && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: 'var(--color-danger-subtle)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)'
              }}
              role="alert"
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                <strong>PERINGATAN INTEGRITAS:</strong> Tindakan ini akan <u>menghapus dan menimpa seluruh database aktif</u> dengan rekaman dari berkas cadangan terpilih. Pastikan Anda telah membuat cadangan database terkini sebelum melanjutkan.
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '12px',
                backgroundColor: 'var(--color-bg)'
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '8px',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '4px'
                }}
              >
                Rincian Berkas Cadangan Terverifikasi:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>
                  <span className="text-muted">Nama Berkas:</span>
                  <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{pendingFilename}</div>
                </div>
                <div>
                  <span className="text-muted">Waktu Backup:</span>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(pendingValidation.metadata.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <span className="text-muted">ID SPBU Asal:</span>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{pendingValidation.metadata.stationId}</div>
                </div>
                <div>
                  <span className="text-muted">Versi Skema:</span>
                  <div style={{ fontWeight: 600 }}>v{pendingValidation.metadata.schemaVersion} (Kompatibel)</div>
                </div>
                <div>
                  <span className="text-muted">Total Baris Rekaman:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                    {pendingValidation.recordCount} baris
                  </div>
                </div>
                <div>
                  <span className="text-muted">Status Integritas:</span>
                  <div style={{ fontWeight: 600, color: '#065F46' }}>Lolos Verifikasi Hash & Relasi Data</div>
                </div>
              </div>

              {pendingValidation.metadata.tableCounts && (
                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: '11.5px'
                  }}
                >
                  <span className="text-muted">Ringkasan Tabel Utama: </span>
                  <span>
                    Akun ({pendingValidation.metadata.tableCounts.accounts || 0}), Produk (
                    {pendingValidation.metadata.tableCounts.products || 0}), Transaksi (
                    {pendingValidation.metadata.tableCounts.transactions || 0}), Jurnal (
                    {pendingValidation.metadata.tableCounts.journals || 0}), Absensi (
                    {pendingValidation.metadata.tableCounts.attendances || 0}), Piutang (
                    {pendingValidation.metadata.tableCounts.receivables || 0})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
