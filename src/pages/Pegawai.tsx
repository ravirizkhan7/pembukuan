import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Plus,
  Edit2,
  Filter,
  CheckCircle2,
  Calendar,
  RotateCcw,
  UserX,
  ShieldCheck,
  QrCode,
  Download
} from 'lucide-react';
import { PageHeader, MetricCard } from '../components/common';
import { Card, Button, Modal, Badge } from '../components/ui';
import { Pegawai, Attendance, AttendanceStatus, ToastType } from '../types';
import { useAppContext } from '../context/AppContext';
import {
  generateEmployeeIdCardPngDataUrl,
  formatQrFilename,
  downloadQrPng
} from '../services/qrService';
import { CameraQrScannerModal, ScanResultDetail } from '../components/CameraQrScannerModal';
import { getLocalDateString, getLocalTimeString } from '../services/appSettings';

export interface PegawaiPageProps {
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function PegawaiPage({
  activeSubTab = 'daftar_pegawai',
  onSubTabChange,
  showToast
}: PegawaiPageProps) {
  const {
    pegawaiList,
    addPegawai,
    updatePegawai,
    togglePegawaiStatus,
    shifts,
    activeShift,
    bukaShift,
    tutupShift,
    attendances,
    addAttendance,
    updateAttendance,
    transactions
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'daftar_pegawai');

  React.useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  const handleTabSwitch = (tabId: string) => {
    setActiveTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  // ==========================================
  // TAB 1: MASTER PEGAWAI STATE & HANDLERS
  // ==========================================
  const [isPegawaiModalOpen, setIsPegawaiModalOpen] = useState<boolean>(false);
  const [editingPegawai, setEditingPegawai] = useState<Pegawai | null>(null);
  const [formPegawaiName, setFormPegawaiName] = useState<string>('');
  const [formPegawaiRole, setFormPegawaiRole] = useState<string>('Operator Kasir');
  const [formPegawaiShiftId, setFormPegawaiShiftId] = useState<string>(shifts[0]?.id || 'SFT-01');
  const [formPegawaiStatus, setFormPegawaiStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddPegawaiModal = () => {
    setEditingPegawai(null);
    setFormPegawaiName('');
    setFormPegawaiRole('Operator Kasir');
    setFormPegawaiShiftId(shifts[0]?.id || 'SFT-01');
    setFormPegawaiStatus('Aktif');
    setIsPegawaiModalOpen(true);
  };

  const openEditPegawaiModal = (p: Pegawai) => {
    setEditingPegawai(p);
    setFormPegawaiName(p.name);
    setFormPegawaiRole(p.role);
    setFormPegawaiShiftId(p.shiftId);
    setFormPegawaiStatus(p.status);
    setIsPegawaiModalOpen(true);
  };

  const handleSavePegawai = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formPegawaiName.trim()) {
      showToast('Nama pegawai wajib diisi.', 'danger');
      return;
    }

    if (editingPegawai) {
      updatePegawai({
        ...editingPegawai,
        name: formPegawaiName.trim(),
        role: formPegawaiRole.trim(),
        shiftId: formPegawaiShiftId,
        status: formPegawaiStatus
      });
      showToast(`Data pegawai [${formPegawaiName.trim()}] berhasil diperbarui.`, 'success');
    } else {
      const created = addPegawai({
        name: formPegawaiName.trim(),
        role: formPegawaiRole.trim(),
        shiftId: formPegawaiShiftId,
        status: formPegawaiStatus
      });
      showToast(`Pegawai baru [${created.id} - ${created.name}] berhasil ditambahkan.`, 'success');
    }

    setIsPegawaiModalOpen(false);
  };

  const handleTogglePegawai = (p: Pegawai) => {
    togglePegawaiStatus(p.id);
    const nextStatus = p.status === 'Aktif' ? 'dinonaktifkan' : 'diaktifkan';
    showToast(`Status pegawai [${p.name}] ${nextStatus}.`, 'primary');
  };

  // ==========================================
  // QR CODE PREVIEW & DOWNLOAD STATE & HANDLERS
  // ==========================================
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [selectedPegawaiForQr, setSelectedPegawaiForQr] = useState<Pegawai | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

  const handleOpenQrModal = async (p: Pegawai) => {
    setSelectedPegawaiForQr(p);
    setIsGeneratingQr(true);
    setQrDataUrl('');
    setIsQrModalOpen(true);
    try {
      // Generate ID card PNG with QR code (strictly p.id as payload), Nama, and Jabatan
      const url = await generateEmployeeIdCardPngDataUrl(p.id, p.name, p.role);
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code card:', err);
      showToast('Gagal membuat kartu QR Code pegawai.', 'danger');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleDownloadQrPng = () => {
    if (!selectedPegawaiForQr || !qrDataUrl) return;
    try {
      const filename = formatQrFilename(selectedPegawaiForQr.name, selectedPegawaiForQr.id);
      downloadQrPng(qrDataUrl, filename);
      showToast(`Kartu QR Code [${filename}] berhasil diunduh.`, 'success');
    } catch (err) {
      console.error('Failed to download QR code:', err);
      showToast('Gagal mengunduh file Kartu QR Code PNG.', 'danger');
    }
  };

  // ==========================================
  // TAB 2: ABSENSI STATE & HANDLERS
  // ==========================================
  const [filterDate, setFilterDate] = useState<string>(getLocalDateString());
  const [filterShiftId, setFilterShiftId] = useState<string>('all');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Live Camera QR Scanner State & Handler
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);

  const handleScanAttendance = useCallback(
    (payload: string): ScanResultDetail => {
      const trimmedId = payload.trim();
      // 1. Search employee in Master Pegawai by ID
      const emp = pegawaiList.find((p) => p.id === trimmedId);

      if (!emp) {
        return {
          success: false,
          payload: trimmedId,
          message: `ID [${trimmedId}] tidak ditemukan dalam Master Pegawai.`
        };
      }

      // 2. Retrieve shift assigned to employee in Master Pegawai
      const assignedShift = shifts.find((s) => s.id === emp.shiftId) || shifts[0];

      // 3. Current local time & business date when actually scanned (independent of table filter)
      const now = new Date();
      const timeStr = getLocalTimeString(now);
      const dateStr = getLocalDateString(now);

      // 4. Duplicate check based on employeeId + business date
      const existingAttendance = attendances.find(
        (a) => a.employeeId === emp.id && a.date === dateStr
      );

      if (existingAttendance) {
        showToast(
          `[${emp.name}] sudah memiliki absensi untuk hari ini (${dateStr}). Absensi sudah diambil.`,
          'warning'
        );

        return {
          success: true,
          payload: trimmedId,
          pegawai: emp,
          shift: assignedShift,
          time: existingAttendance.checkInTime || timeStr,
          message: 'Absensi sudah diambil.',
          isAlreadyAttended: true
        };
      }

      // 5. Record new attendance if not attended yet
      addAttendance({
        employeeId: emp.id,
        employeeName: emp.name,
        shiftId: assignedShift.id,
        shiftName: assignedShift.name,
        date: dateStr,
        status: 'Hadir',
        checkInTime: timeStr,
        notes: 'Presensi Live Scanner QR'
      });

      showToast(
        `Presensi [${emp.name}] (${assignedShift.name}) berhasil dicatat.`,
        'success'
      );

      return {
        success: true,
        payload: trimmedId,
        pegawai: emp,
        shift: assignedShift,
        time: timeStr,
        isAlreadyAttended: false
      };
    },
    [pegawaiList, shifts, attendances, addAttendance, showToast]
  );

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);

  const [formEmployeeId, setFormEmployeeId] = useState<string>(pegawaiList[0]?.id || 'OPR-001');
  const [formAttDate, setFormAttDate] = useState<string>(getLocalDateString());
  const [formAttStatus, setFormAttStatus] = useState<AttendanceStatus>('Hadir');
  const [formAttCheckInTime, setFormAttCheckInTime] = useState<string>('07:00');
  const [formAttNotes, setFormAttNotes] = useState<string>('');

  // Selected employee for attendance automatically determines their shift
  const selectedEmployeeForAttendance = useMemo(() => {
    return pegawaiList.find((p) => p.id === formEmployeeId) || pegawaiList[0];
  }, [pegawaiList, formEmployeeId]);

  const assignedShiftForSelectedEmployee = useMemo(() => {
    if (!selectedEmployeeForAttendance) return shifts[0];
    return shifts.find((s) => s.id === selectedEmployeeForAttendance.shiftId) || shifts[0];
  }, [shifts, selectedEmployeeForAttendance]);

  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      const matchDate = !filterDate || att.date === filterDate;
      const matchShift = filterShiftId === 'all' || att.shiftId === filterShiftId;
      const matchEmp = filterEmployeeId === 'all' || att.employeeId === filterEmployeeId;
      const matchStatus = filterStatus === 'all' || att.status === filterStatus;
      return matchDate && matchShift && matchEmp && matchStatus;
    });
  }, [attendances, filterDate, filterShiftId, filterEmployeeId, filterStatus]);

  const openAddAttendanceModal = () => {
    setEditingAttendance(null);
    const defaultEmp = pegawaiList.find((p) => p.status === 'Aktif') || pegawaiList[0];
    if (defaultEmp) {
      setFormEmployeeId(defaultEmp.id);
      const defaultShift = shifts.find((s) => s.id === defaultEmp.shiftId) || shifts[0];
      setFormAttCheckInTime(defaultShift?.startTime || '07:00');
    }
    setFormAttDate(getLocalDateString());
    setFormAttStatus('Hadir');
    setFormAttNotes('');
    setIsAttendanceModalOpen(true);
  };

  const openEditAttendanceModal = (att: Attendance) => {
    setEditingAttendance(att);
    setFormEmployeeId(att.employeeId);
    setFormAttDate(att.date);
    setFormAttStatus(att.status);
    setFormAttCheckInTime(att.checkInTime || '07:00');
    setFormAttNotes(att.notes || '');
    setIsAttendanceModalOpen(true);
  };

  const handleSaveAttendance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedEmployeeForAttendance) {
      showToast('Pilih pegawai yang valid dari master pegawai.', 'danger');
      return;
    }

    const assignedShift = assignedShiftForSelectedEmployee;

    if (editingAttendance) {
      updateAttendance({
        ...editingAttendance,
        employeeId: selectedEmployeeForAttendance.id,
        employeeName: selectedEmployeeForAttendance.name,
        shiftId: assignedShift.id,
        shiftName: assignedShift.name,
        date: formAttDate,
        status: formAttStatus,
        checkInTime: formAttCheckInTime,
        notes: formAttNotes.trim()
      });
      showToast(`Absensi [${selectedEmployeeForAttendance.name}] (${assignedShift.name}) berhasil diperbarui.`, 'success');
    } else {
      addAttendance({
        employeeId: selectedEmployeeForAttendance.id,
        employeeName: selectedEmployeeForAttendance.name,
        shiftId: assignedShift.id,
        shiftName: assignedShift.name,
        date: formAttDate,
        status: formAttStatus,
        checkInTime: formAttCheckInTime,
        notes: formAttNotes.trim()
      });
      showToast(`Absensi [${selectedEmployeeForAttendance.name}] (${assignedShift.name}) berhasil dicatat.`, 'success');
    }

    setIsAttendanceModalOpen(false);
  };

  // ==========================================
  // TAB 3: SHIFT KERJA STATE & MODALS
  // ==========================================
  const [isBukaShiftModalOpen, setIsBukaShiftModalOpen] = useState<boolean>(false);
  const [isTutupShiftModalOpen, setIsTutupShiftModalOpen] = useState<boolean>(false);
  const [selectedShiftToOpen, setSelectedShiftToOpen] = useState<string>(
    shifts.find((s) => s.status === 'Menunggu')?.id || shifts[0]?.id || 'SFT-01'
  );
  const [bukaDate, setBukaDate] = useState<string>(getLocalDateString());
  const [bukaStartTime, setBukaStartTime] = useState<string>('07:00');
  const [bukaOperator, setBukaOperator] = useState<string>('Ahmad Fauzi');
  const [bukaInitialCash, setBukaInitialCash] = useState<string>('1000000');

  const [selectedShiftToClose, setSelectedShiftToClose] = useState<string>(
    activeShift?.id || shifts.find((s) => s.status === 'Aktif')?.id || 'SFT-01'
  );
  const [tutupCashHandover, setTutupCashHandover] = useState<string>('');

  const targetShiftToClose = shifts.find((s) => s.id === selectedShiftToClose) || activeShift || shifts[0];
  const shiftTxList = transactions.filter((t) => t.shiftId === targetShiftToClose?.id);
  const calculatedShiftSales =
    shiftTxList.reduce((acc, t) => acc + (t.total || 0), 0) || targetShiftToClose?.totalSales || 0;
  const initialCashVal = targetShiftToClose?.initialCash || 0;

  const openBukaShiftDialog = (shiftId?: string) => {
    const target = shiftId ? shifts.find((s) => s.id === shiftId) : shifts.find((s) => s.status === 'Menunggu') || shifts[0];
    if (target) {
      setSelectedShiftToOpen(target.id);
      setBukaStartTime(target.startTime || '07:00');
      // Suggest officer from assigned employees of this shift
      const assigned = pegawaiList.filter((p) => p.shiftId === target.id && p.status === 'Aktif');
      setBukaOperator(assigned[0]?.name || target.operator || 'Operator SPBU');
      setBukaInitialCash(target.initialCash?.toString() || '1000000');
    }
    setIsBukaShiftModalOpen(true);
  };

  const openTutupShiftDialog = (shiftId?: string) => {
    const target = shiftId ? shifts.find((s) => s.id === shiftId) : activeShift || shifts.find((s) => s.status === 'Aktif') || shifts[0];
    if (target) {
      setSelectedShiftToClose(target.id);
      const estTotal = (target.initialCash || 0) + (target.totalSales || 0);
      setTutupCashHandover(estTotal.toString());
    }
    setIsTutupShiftModalOpen(true);
  };

  const handleExecuteBukaShift = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    bukaShift(selectedShiftToOpen, {
      date: bukaDate,
      startTime: bukaStartTime,
      operator: bukaOperator.trim(),
      initialCash: parseFloat(bukaInitialCash) || 0
    });
    const s = shifts.find((item) => item.id === selectedShiftToOpen);
    showToast(`${s?.name || selectedShiftToOpen} berhasil dibuka (Aktif).`, 'success');
    setIsBukaShiftModalOpen(false);
  };

  const handleExecuteTutupShift = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tutupCashHandover) {
      showToast('Masukkan jumlah setoran kas fisik.', 'danger');
      return;
    }

    tutupShift(selectedShiftToClose, {
      cashHandover: parseFloat(tutupCashHandover) || 0
    });
    const s = shifts.find((item) => item.id === selectedShiftToClose);
    showToast(`${s?.name || selectedShiftToClose} telah ditutup.`, 'success');
    setIsTutupShiftModalOpen(false);
  };

  // Helper badge color
  const getStatusBadgeVariant = (status: AttendanceStatus) => {
    switch (status) {
      case 'Hadir':
        return 'success';
      case 'Izin':
        return 'warning';
      case 'Sakit':
        return 'primary';
      case 'Alpa':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ paddingBottom: '36px' }}>
      {/* SUBTAB PILL BAR */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '4px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: '20px',
          width: 'fit-content'
        }}
      >
        <button
          type="button"
          onClick={() => handleTabSwitch('daftar_pegawai')}
          id="tab-btn-daftar-pegawai"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--border-radius-sm)',
            border: 'none',
            backgroundColor: activeTab === 'daftar_pegawai' ? 'var(--color-white)' : 'transparent',
            color: activeTab === 'daftar_pegawai' ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
            fontWeight: activeTab === 'daftar_pegawai' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'daftar_pegawai' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={16} />
          Daftar Pegawai
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('absensi')}
          id="tab-btn-absensi"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--border-radius-sm)',
            border: 'none',
            backgroundColor: activeTab === 'absensi' ? 'var(--color-white)' : 'transparent',
            color: activeTab === 'absensi' ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
            fontWeight: activeTab === 'absensi' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'absensi' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <UserCheck size={16} />
          Absensi
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('shift_kerja')}
          id="tab-btn-shift-kerja"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--border-radius-sm)',
            border: 'none',
            backgroundColor: activeTab === 'shift_kerja' ? 'var(--color-white)' : 'transparent',
            color: activeTab === 'shift_kerja' ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
            fontWeight: activeTab === 'shift_kerja' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'shift_kerja' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={16} />
          Shift Kerja
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: DAFTAR PEGAWAI (MASTER DATA SUMBER)                            */}
      {/* ========================================================================= */}
      {activeTab === 'daftar_pegawai' && (
        <div>
          <PageHeader
            category="MANAJEMEN PEGAWAI"
            title="Daftar Master Pegawai & Operator"
            subtitle="Master data tunggal petugas operasional SPBU, penugasan shift kerja, dan status kepegawaian"
            actions={
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={openAddPegawaiModal}
                id="btn-tambah-pegawai"
                style={{ fontWeight: 600 }}
              >
                + Tambah Pegawai
              </Button>
            }
          />

          {/* Metric Cards Master Pegawai */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              marginBottom: '20px'
            }}
          >
            <MetricCard
              title="Total Pegawai Terdaftar"
              value={pegawaiList.length.toString()}
              unit="Orang"
              subtitle="Master Data Sumber"
              icon={Users}
            />
            <MetricCard
              title="Pegawai Status Aktif"
              value={pegawaiList.filter((p) => p.status === 'Aktif').length.toString()}
              unit="Orang"
              subtitle="Siap bertugas"
              icon={CheckCircle2}
            />
            <MetricCard
              title="Penugasan Shift 1"
              value={pegawaiList.filter((p) => p.shiftId === 'SFT-01').length.toString()}
              unit="Pegawai"
              subtitle="Jadwal 07:00–15:00 WIB"
              icon={Clock}
            />
            <MetricCard
              title="Penugasan Shift 2"
              value={pegawaiList.filter((p) => p.shiftId === 'SFT-02').length.toString()}
              unit="Pegawai"
              subtitle="Jadwal 15:00–23:00 WIB"
              icon={Clock}
            />
          </div>

          {/* Tabel Master Pegawai */}
          <Card
            title="Daftar Petugas & Operator SPBU"
            subtitle={`Menampilkan ${pegawaiList.length} master pegawai terdaftar sebagai sumber absensi & penugasan shift`}
            actions={
              <Badge variant="primary">
                {pegawaiList.filter((p) => p.status === 'Aktif').length} Aktif
              </Badge>
            }
          >
            <div className="table-responsive">
              <table className="table" id="table-daftar-pegawai">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>ID Pegawai</th>
                    <th>Nama Pegawai</th>
                    <th>Jabatan / Role</th>
                    <th>Penugasan Shift</th>
                    <th>Jam Kerja Shift</th>
                    <th>Status</th>
                    <th style={{ width: '270px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pegawaiList.map((p) => {
                    const assignedShift = shifts.find((s) => s.id === p.shiftId);
                    return (
                      <tr key={p.id} style={{ opacity: p.status === 'Aktif' ? 1 : 0.65 }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue-900)' }}>
                          {p.id}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--blue-100)',
                                color: 'var(--blue-900)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              {p.name.charAt(0)}
                            </div>
                            <strong style={{ fontSize: '13.5px', color: 'var(--color-dark-text)' }}>
                              {p.name}
                            </strong>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>
                            {p.role}
                          </span>
                        </td>
                        <td>
                          <Badge variant={p.shiftId === 'SFT-01' ? 'primary' : 'warning'}>
                            {assignedShift ? assignedShift.name : p.shiftId}
                          </Badge>
                        </td>
                        <td>
                          <span style={{ fontSize: '13px', color: 'var(--color-muted-text)', fontWeight: 500 }}>
                            {assignedShift ? `${assignedShift.startTime} - ${assignedShift.endTime} WIB` : '-'}
                          </span>
                        </td>
                        <td>
                          <Badge variant={p.status === 'Aktif' ? 'success' : 'neutral'}>
                            {p.status}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleOpenQrModal(p)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              id={`btn-qr-pegawai-${p.id}`}
                            >
                              <QrCode size={13} style={{ marginRight: '4px' }} />
                              Lihat QR
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditPegawaiModal(p)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              id={`btn-edit-pegawai-${p.id}`}
                            >
                              <Edit2 size={13} style={{ marginRight: '4px' }} />
                              Ubah
                            </Button>
                            <Button
                              variant={p.status === 'Aktif' ? 'ghost' : 'outline-primary'}
                              size="sm"
                              onClick={() => handleTogglePegawai(p)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                color: p.status === 'Aktif' ? 'var(--color-danger)' : undefined
                              }}
                              id={`btn-toggle-pegawai-${p.id}`}
                            >
                              {p.status === 'Aktif' ? (
                                <>
                                  <UserX size={13} style={{ marginRight: '4px' }} />
                                  Nonaktifkan
                                </>
                              ) : (
                                <>
                                  <ShieldCheck size={13} style={{ marginRight: '4px' }} />
                                  Aktifkan
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: ABSENSI (BERELASI KE MASTER PEGAWAI)                            */}
      {/* ========================================================================= */}
      {activeTab === 'absensi' && (
        <div>
          <PageHeader
            category="MANAJEMEN PEGAWAI"
            title="Absensi & Kehadiran Pegawai"
            subtitle="Pencatatan presensi harian operator (Jadwal shift otomatis terikat dengan penugasan Master Pegawai)"
            actions={
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="outline-primary"
                  size="md"
                  icon={QrCode}
                  onClick={() => setIsScannerModalOpen(true)}
                  id="btn-scan-qr-absensi"
                  style={{ fontWeight: 600 }}
                >
                  Scan QR Absensi
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={Plus}
                  onClick={openAddAttendanceModal}
                  id="btn-catat-absensi"
                  style={{ fontWeight: 600 }}
                >
                  + Catat Kehadiran
                </Button>
              </div>
            }
          />

          {/* Metric Cards Absensi */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              marginBottom: '18px'
            }}
          >
            <MetricCard
              title="Total Presensi Hari Ini"
              value={attendances.filter((a) => a.date === filterDate).length.toString()}
              unit="Catatan"
              subtitle={`Tanggal ${filterDate || 'Semua Tanggal'}`}
              icon={Users}
            />
            <MetricCard
              title="Pegawai Hadir"
              value={attendances.filter((a) => a.date === filterDate && a.status === 'Hadir').length.toString()}
              unit="Orang"
              subtitle="Status Hadir di SPBU"
              icon={CheckCircle2}
            />
            <MetricCard
              title="Izin / Sakit"
              value={attendances
                .filter((a) => a.date === filterDate && (a.status === 'Izin' || a.status === 'Sakit'))
                .length.toString()}
              unit="Orang"
              subtitle="Pemberitahuan resmi"
              icon={UserCheck}
            />
            <MetricCard
              title="Master Pegawai"
              value={`${pegawaiList.length} Pegawai`}
              subtitle="Semua petugas siap dipresensi"
              icon={ShieldCheck}
            />
          </div>

          {/* Active Shift Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: 'var(--blue-50)',
              border: '1px solid var(--blue-200)',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '16px',
              fontSize: '13px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: activeShift ? '#10B981' : '#94A3B8'
                }}
              />
              <span style={{ color: 'var(--blue-900)', fontWeight: 600 }}>
                {activeShift
                  ? `Shift Operasional Aktif: [${activeShift.id}] ${activeShift.name} (${activeShift.startTime} - ${activeShift.endTime} WIB) — Operator Kasir: ${activeShift.operator}`
                  : 'Belum ada sesi shift aktif yang dibuka. Buka sesi di tab Shift Kerja.'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--blue-800)', fontWeight: 500 }}>
              Master Shift: Shift 1 (07:00–15:00) • Shift 2 (15:00–23:00)
            </div>
          </div>

          {/* Filter Bar */}
          <Card style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13.5px' }}>
                <Filter size={15} color="var(--color-primary)" />
                <span>Filter Presensi Pegawai</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterDate(getLocalDateString());
                  setFilterShiftId('all');
                  setFilterEmployeeId('all');
                  setFilterStatus('all');
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
              >
                <RotateCcw size={13} />
                Reset Filter
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Tanggal Presensi</label>
                <input
                  type="date"
                  className="form-control"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Pegawai (Master Sumber)</label>
                <select
                  className="form-select"
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Semua Pegawai</option>
                  {pegawaiList.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.id}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Shift Kerja</label>
                <select
                  className="form-select"
                  value={filterShiftId}
                  onChange={(e) => setFilterShiftId(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Semua Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime} WIB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Status Kehadiran</label>
                <select
                  className="form-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Semua Status</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Tabel Rekap Presensi */}
          <Card
            title="Rekap Catatan Presensi Pegawai"
            subtitle={`Menampilkan ${filteredAttendances.length} catatan kehadiran berelasi ke Master Pegawai`}
            actions={
              <Badge variant="neutral">
                {filteredAttendances.length} Data
              </Badge>
            }
          >
            <div className="table-responsive">
              <table className="table" id="table-absensi">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>ID Presensi</th>
                    <th style={{ width: '110px' }}>Tanggal</th>
                    <th>Pegawai (Master)</th>
                    <th>Shift Kerja</th>
                    <th>Jam Presensi</th>
                    <th>Status</th>
                    <th>Catatan / Keterangan</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted-text)' }}>
                        Tidak ada catatan absensi yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((att) => {
                      const empDetail = pegawaiList.find((p) => p.id === att.employeeId);
                      const sftDetail = shifts.find((s) => s.id === att.shiftId);
                      const displayName = empDetail ? empDetail.name : att.employeeName || 'Pegawai';
                      return (
                        <tr key={att.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--blue-900)' }}>
                            {att.id}
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Calendar size={13} color="var(--color-muted-text)" />
                              {att.date}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: 'var(--color-dark-text)' }}>{displayName}</strong>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  padding: '1px 5px',
                                  backgroundColor: 'var(--color-surface-subtle)',
                                  borderRadius: '3px',
                                  color: 'var(--color-muted-text)'
                                }}
                              >
                                {att.employeeId}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong style={{ color: 'var(--color-primary-dark)' }}>
                                {sftDetail ? sftDetail.name : att.shiftName || att.shiftId}
                              </strong>
                              <div style={{ fontSize: '11.5px', color: 'var(--color-muted-text)' }}>
                                {sftDetail ? `${sftDetail.startTime} - ${sftDetail.endTime} WIB` : '-'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                              <Clock size={13} color="var(--color-muted-text)" />
                              {att.checkInTime || '-'}
                            </span>
                          </td>
                          <td>
                            <Badge variant={getStatusBadgeVariant(att.status)}>
                              {att.status}
                            </Badge>
                          </td>
                          <td style={{ color: att.notes ? 'var(--color-dark-text)' : 'var(--color-muted-text)' }}>
                            {att.notes || '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditAttendanceModal(att)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              title="Ubah Absensi"
                              id={`btn-edit-absensi-${att.id}`}
                            >
                              <Edit2 size={13} style={{ marginRight: '4px' }} />
                              Ubah
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: SHIFT KERJA (MASTER JADWAL & PENUGASAN PEGAWAI)                 */}
      {/* ========================================================================= */}
      {activeTab === 'shift_kerja' && (
        <div>
          <PageHeader
            category="MANAJEMEN PEGAWAI"
            title="Master Jadwal & Penugasan Shift Kerja"
            subtitle="Jadwal operasional shift, daftar penugasan pegawai dari Master Pegawai, dan sesi operasional kasir"
            actions={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openBukaShiftDialog()}
                  id="btn-buka-shift-master"
                >
                  Buka Sesi Shift
                </Button>
                {activeShift && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openTutupShiftDialog()}
                    id="btn-tutup-shift-master"
                  >
                    Tutup Shift Aktif
                  </Button>
                )}
              </div>
            }
          />

          {/* DUA KARTU MASTER SHIFT LENGKAP PENUGASAN PEGAWAI */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '18px',
              marginBottom: '22px'
            }}
          >
            {shifts.map((s) => {
              const assignedPegawai = pegawaiList.filter((p) => p.shiftId === s.id);
              const isShiftAktif = s.status === 'Aktif';

              return (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'var(--color-white)',
                    border: `1.5px solid ${isShiftAktif ? 'var(--blue-400)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--border-radius-md)',
                    padding: '20px',
                    boxShadow: isShiftAktif ? '0 4px 12px rgba(0, 119, 182, 0.1)' : 'var(--shadow-sm)',
                    position: 'relative'
                  }}
                >
                  {/* Top Bar Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {s.id}
                      </div>
                      <h3 style={{ margin: '2px 0 0 0', fontSize: '19px', fontWeight: 800, color: 'var(--color-dark-text)' }}>
                        {s.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '13.5px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                        <Clock size={14} />
                        {s.startTime} - {s.endTime} WIB
                      </div>
                    </div>
                    <Badge variant={isShiftAktif ? 'primary' : s.status === 'Menunggu' ? 'warning' : 'neutral'}>
                      {s.status}
                    </Badge>
                  </div>

                  {/* Sesi info ringkas */}
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      borderRadius: 'var(--border-radius-xs)',
                      marginBottom: '16px',
                      fontSize: '12.5px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span className="text-muted">Kasir Bertugas:</span>{' '}
                      <strong>{s.operator || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Penjualan Sesi:</span>{' '}
                      <strong style={{ color: 'var(--color-primary-dark)' }}>
                        Rp {s.totalSales.toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  {/* SECTION: PEGAWAI YANG DITUGASKAN (DARI MASTER PEGAWAI) */}
                  <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-text)', letterSpacing: '0.4px' }}>
                        Pegawai Ditugaskan ({assignedPegawai.length} Orang)
                      </span>
                    </div>

                    {assignedPegawai.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', fontStyle: 'italic' }}>
                        Belum ada pegawai yang ditugaskan ke {s.name}. Atur di Daftar Pegawai.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {assignedPegawai.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              backgroundColor: p.status === 'Aktif' ? 'var(--blue-50)' : 'var(--color-surface-subtle)',
                              borderRadius: 'var(--border-radius-xs)',
                              border: '1px solid var(--blue-200)',
                              fontSize: '12.5px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <Users size={13} color="var(--color-primary)" />
                              <strong style={{ color: 'var(--color-dark-text)' }}>{p.name}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--color-muted-text)', fontFamily: 'monospace' }}>
                                [{p.id}]
                              </span>
                            </div>
                            <span style={{ fontSize: '11.5px', color: 'var(--color-muted-text)' }}>
                              {p.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buka/Tutup */}
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    {isShiftAktif ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openTutupShiftDialog(s.id)}
                        id={`btn-tutup-${s.id}`}
                      >
                        Tutup Sesi Ini
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openBukaShiftDialog(s.id)}
                        id={`btn-buka-${s.id}`}
                      >
                        Buka Sesi Ini
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABEL REKAPITULASI SESI SHIFT */}
          <Card
            title="Riwayat & Rekapitulasi Sesi Shift Operasional"
            subtitle="Pencatatan sesi buka/tutup kasir, modal awal kas, dan setoran fisik"
          >
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Shift ID</th>
                    <th>Nama Shift</th>
                    <th>Jam Kerja</th>
                    <th>Kasir Aktif</th>
                    <th className="table-num">Modal Awal</th>
                    <th className="table-num">Penjualan Shift</th>
                    <th className="table-num">Setoran Fisik</th>
                    <th className="table-num">Selisih Kas</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} style={{ backgroundColor: s.status === 'Aktif' ? 'rgba(3, 4, 94, 0.02)' : undefined }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.id}</td>
                      <td style={{ fontWeight: 700, color: s.status === 'Aktif' ? 'var(--color-primary)' : 'inherit' }}>
                        {s.name}
                      </td>
                      <td>{s.startTime} - {s.endTime} WIB</td>
                      <td style={{ fontWeight: 600 }}>{s.operator || '-'}</td>
                      <td className="table-num">
                        {s.initialCash ? `Rp ${s.initialCash.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="table-num" style={{ fontWeight: 600 }}>
                        Rp {s.totalSales.toLocaleString('id-ID')}
                      </td>
                      <td className="table-num">
                        {s.cashHandover > 0 ? `Rp ${s.cashHandover.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="table-num">
                        {s.discrepancy !== undefined && s.status === 'Tutup' ? (
                          <span style={{ color: s.discrepancy < 0 ? 'var(--color-danger)' : s.discrepancy > 0 ? '#10B981' : 'inherit', fontWeight: 600 }}>
                            Rp {s.discrepancy.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <Badge variant={s.status === 'Aktif' ? 'primary' : s.status === 'Menunggu' ? 'warning' : 'neutral'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td>
                        {s.status === 'Aktif' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openTutupShiftDialog(s.id)}
                            style={{ padding: '3px 10px', fontSize: '12px' }}
                          >
                            Tutup Shift
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openBukaShiftDialog(s.id)}
                            style={{ padding: '3px 10px', fontSize: '12px' }}
                          >
                            Buka Shift
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH / UBAH MASTER PEGAWAI                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPegawaiModalOpen}
        onClose={() => setIsPegawaiModalOpen(false)}
        title={editingPegawai ? 'Ubah Data Master Pegawai' : 'Tambah Pegawai Baru (Master)'}
      >
        <form onSubmit={handleSavePegawai} id="form-pegawai">
          <div className="form-group">
            <label className="form-label">
              Nama Lengkap Pegawai <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formPegawaiName}
              onChange={(e) => setFormPegawaiName(e.target.value)}
              placeholder="Contoh: Rima, Budi Santoso"
              required
              id="input-pegawai-name"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Jabatan / Role</label>
              <input
                type="text"
                className="form-control"
                value={formPegawaiRole}
                onChange={(e) => setFormPegawaiRole(e.target.value)}
                placeholder="Operator Kasir"
                id="input-pegawai-role"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Status Kepegawaian <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formPegawaiStatus}
                onChange={(e) => setFormPegawaiStatus(e.target.value as 'Aktif' | 'Nonaktif')}
                id="select-pegawai-status"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          {/* Penugasan Shift dari Master Shift */}
          <div className="form-group">
            <label className="form-label">
              Penugasan Shift Kerja <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={formPegawaiShiftId}
              onChange={(e) => setFormPegawaiShiftId(e.target.value)}
              required
              id="select-pegawai-shift"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} ({s.startTime} - {s.endTime} WIB)
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--blue-50)',
              border: '1px solid var(--blue-200)',
              borderRadius: 'var(--border-radius-xs)',
              marginBottom: '14px',
              fontSize: '12px',
              color: 'var(--blue-900)'
            }}
          >
            <strong>Prinsip Master Data Tunggal:</strong> Pegawai yang disimpan akan langsung otomatis tersedia sebagai opsi di menu Absensi dan penugasan Shift Kerja.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsPegawaiModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" id="btn-simpan-pegawai" style={{ fontWeight: 700 }}>
              {editingPegawai ? 'Simpan Perubahan' : 'Simpan Pegawai'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CATAT / UBAH PRESENSI (AUTO-SYNC SHIFT DARI PEGAWAI)             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        title={editingAttendance ? 'Ubah Catatan Presensi Pegawai' : 'Catat Presensi Kehadiran Pegawai'}
      >
        <form onSubmit={handleSaveAttendance} id="form-absensi">
          {/* Pilih Pegawai dari Master */}
          <div className="form-group">
            <label className="form-label">
              Pilih Pegawai (Master Sumber) <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={formEmployeeId}
              onChange={(e) => {
                const empId = e.target.value;
                setFormEmployeeId(empId);
                const matched = pegawaiList.find((p) => p.id === empId);
                if (matched) {
                  const s = shifts.find((sh) => sh.id === matched.shiftId);
                  if (s && !editingAttendance) {
                    setFormAttCheckInTime(s.startTime);
                  }
                }
              }}
              required
              id="select-absensi-pegawai"
            >
              {pegawaiList.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.id}] {p.name} — Penugasan: {shifts.find((s) => s.id === p.shiftId)?.name || p.shiftId} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* TAMPILAN SHIFT OTOMATIS MENGIKUTI DATA PEGAWAI */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--blue-50)',
              border: '1.5px solid var(--blue-300)',
              borderRadius: 'var(--border-radius-xs)',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue-900)', textTransform: 'uppercase' }}>
                Shift Kerja Pegawai:
              </span>
              <Badge variant="primary">
                {assignedShiftForSelectedEmployee.name}
              </Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Clock size={14} color="var(--color-primary)" />
              <strong style={{ fontSize: '13.5px', color: 'var(--color-primary-dark)' }}>
                {assignedShiftForSelectedEmployee.startTime} - {assignedShiftForSelectedEmployee.endTime} WIB
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted-text)', marginTop: '4px' }}>
              * Shift absensi otomatis mengikuti data penugasan pegawai [{selectedEmployeeForAttendance?.name}] di Master Pegawai.
            </div>
          </div>

          {/* Tanggal & Jam */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Tanggal Kehadiran <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formAttDate}
                onChange={(e) => setFormAttDate(e.target.value)}
                required
                id="input-tanggal-absensi"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Jam Presensi <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={formAttCheckInTime}
                onChange={(e) => setFormAttCheckInTime(e.target.value)}
                placeholder="Contoh: 07:00"
                required
                id="input-jam-absensi"
              />
            </div>
          </div>

          {/* Status Kehadiran */}
          <div className="form-group">
            <label className="form-label">
              Status Kehadiran <span className="required">*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFormAttStatus(st)}
                  className="btn"
                  id={`status-option-${st.toLowerCase()}`}
                  style={{
                    backgroundColor: formAttStatus === st ? 'var(--blue-50)' : 'var(--color-white)',
                    borderColor: formAttStatus === st ? 'var(--color-primary)' : 'var(--color-border)',
                    color: formAttStatus === st ? 'var(--color-primary-dark)' : 'var(--color-dark-text)',
                    fontWeight: formAttStatus === st ? 700 : 500,
                    fontSize: '13px',
                    padding: '8px 4px',
                    borderWidth: formAttStatus === st ? '2px' : '1px'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan */}
          <div className="form-group">
            <label className="form-label">Catatan / Keterangan</label>
            <input
              type="text"
              className="form-control"
              value={formAttNotes}
              onChange={(e) => setFormAttNotes(e.target.value)}
              placeholder="Contoh: Tepat waktu, Tukar shift"
              id="input-catatan-absensi"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
            <Button variant="secondary" onClick={() => setIsAttendanceModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" id="btn-simpan-absensi" style={{ fontWeight: 700 }}>
              {editingAttendance ? 'Simpan Perubahan' : 'Catat Presensi'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: BUKA SESI SHIFT OPERASIONAL                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBukaShiftModalOpen}
        onClose={() => setIsBukaShiftModalOpen(false)}
        title="Buka Sesi Shift Kerja"
      >
        <form onSubmit={handleExecuteBukaShift}>
          <div className="form-group">
            <label className="form-label">
              Pilih Shift yang Dibuka <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={selectedShiftToOpen}
              onChange={(e) => {
                const sid = e.target.value;
                setSelectedShiftToOpen(sid);
                const s = shifts.find((item) => item.id === sid);
                if (s) {
                  setBukaStartTime(s.startTime);
                  const assigned = pegawaiList.filter((p) => p.shiftId === s.id && p.status === 'Aktif');
                  setBukaOperator(assigned[0]?.name || s.operator || 'Operator SPBU');
                }
              }}
              required
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} ({s.startTime} - {s.endTime} WIB) — Status: {s.status}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal Operasional</label>
              <input
                type="date"
                className="form-control"
                value={bukaDate}
                onChange={(e) => setBukaDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jam Mulai</label>
              <input
                type="text"
                className="form-control"
                value={bukaStartTime}
                onChange={(e) => setBukaStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Petugas / Operator Kasir <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={bukaOperator}
                onChange={(e) => setBukaOperator(e.target.value)}
                required
              >
                {pegawaiList
                  .filter((p) => p.status === 'Aktif')
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} [{p.id}] — {shifts.find((s) => s.id === p.shiftId)?.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Modal Kas Awal (Rp)</label>
              <input
                type="number"
                className="form-control"
                value={bukaInitialCash}
                onChange={(e) => setBukaInitialCash(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsBukaShiftModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" style={{ fontWeight: 700 }}>
              Aktifkan Sesi Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: TUTUP SESI SHIFT OPERASIONAL                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTutupShiftModalOpen}
        onClose={() => setIsTutupShiftModalOpen(false)}
        title="Tutup Sesi Shift Kerja"
      >
        <form onSubmit={handleExecuteTutupShift}>
          <div className="form-group">
            <label className="form-label">Pilih Shift yang Ditutup</label>
            <select
              className="form-select"
              value={selectedShiftToClose}
              onChange={(e) => setSelectedShiftToClose(e.target.value)}
              required
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} — Status: {s.status} ({s.operator})
                </option>
              ))}
            </select>
          </div>

          {targetShiftToClose && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                marginBottom: '14px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Kasir Bertugas:</span>
                <strong>{targetShiftToClose.operator}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Jam Kerja:</span>
                <span>{targetShiftToClose.startTime} - {targetShiftToClose.endTime} WIB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Modal Kas Awal:</span>
                <span>Rp {(targetShiftToClose.initialCash || 0).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="text-muted">Penjualan Terhitung:</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>
                  Rp {calculatedShiftSales.toLocaleString('id-ID')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontWeight: 600 }}>Total Estimasi Kas Fisik:</span>
                <strong style={{ fontSize: '14px' }}>
                  Rp {(initialCashVal + calculatedShiftSales).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Jumlah Setoran Kas Fisik (Rp) <span className="required">*</span>
            </label>
            <input
              type="number"
              className="form-control"
              value={tutupCashHandover}
              onChange={(e) => setTutupCashHandover(e.target.value)}
              placeholder="Masukkan jumlah kas fisik yang disetor"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsTutupShiftModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" style={{ fontWeight: 700 }}>
              Konfirmasi Tutup Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: PREVIEW & DOWNLOAD QR CODE PEGAWAI                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="KARTU QR IDENTITAS PEGAWAI"
        icon={QrCode}
      >
        {selectedPegawaiForQr && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: 'var(--color-surface-subtle)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                marginBottom: '16px'
              }}
            >
              {isGeneratingQr ? (
                <div style={{ width: '280px', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-muted">Membuat Kartu Identitas QR...</span>
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Kartu QR ${selectedPegawaiForQr.name} (${selectedPegawaiForQr.id})`}
                  style={{
                    maxWidth: '100%',
                    width: '300px',
                    height: 'auto',
                    display: 'block',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid #E2E8F0'
                  }}
                  id="img-qr-card-preview"
                />
              ) : (
                <div style={{ width: '280px', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="text-muted">Kartu QR tidak tersedia</span>
                </div>
              )}
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--color-muted-text)',
                textAlign: 'left',
                marginBottom: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>Payload QR:</span>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-dark-text)' }}>
                  {selectedPegawaiForQr.id}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>Format File:</span>
                <span>PNG Kartu Identitas (QR, Nama, Jabatan)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Nama File Unduhan:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary-dark)' }}>
                  {formatQrFilename(selectedPegawaiForQr.name, selectedPegawaiForQr.id)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="secondary"
                onClick={() => setIsQrModalOpen(false)}
                id="btn-tutup-qr-modal"
              >
                Tutup
              </Button>
              <Button
                variant="primary"
                icon={Download}
                onClick={handleDownloadQrPng}
                disabled={!qrDataUrl || isGeneratingQr}
                id="btn-download-qr-png"
                style={{ fontWeight: 700 }}
              >
                Unduh Kartu PNG
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: LIVE CAMERA QR SCANNER ABSENSI                                   */}
      {/* ========================================================================= */}
      <CameraQrScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScan={handleScanAttendance}
      />
    </div>
  );
}
