import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Clock,
  Edit2,
  Filter,
  Users,
  CheckCircle2,
  Calendar,
  Info,
  RotateCcw
} from 'lucide-react';
import { PageHeader, MetricCard } from '../components/common';
import { Card, Button, Modal, Badge } from '../components/ui';
import { Attendance, AttendanceStatus, ToastType } from '../types';
import { useAppContext } from '../context/AppContext';

export interface AbsensiPageProps {
  showToast: (message: string, type?: ToastType) => void;
}

export function AbsensiPage({ showToast }: AbsensiPageProps) {
  const {
    operators,
    shifts,
    attendances,
    addAttendance,
    updateAttendance,
    activeShift
  } = useAppContext();

  // Filter States
  const [filterDate, setFilterDate] = useState<string>('2026-09-24');
  const [filterShiftId, setFilterShiftId] = useState<string>('all');
  const [filterOperatorId, setFilterOperatorId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);

  // Form States
  const [formOperatorId, setFormOperatorId] = useState<string>(operators[0]?.id || 'OPR-01');
  const [formShiftId, setFormShiftId] = useState<string>(shifts[0]?.id || 'SFT-01');
  const [formDate, setFormDate] = useState<string>('2026-09-24');
  const [formStatus, setFormStatus] = useState<AttendanceStatus>('Hadir');
  const [formCheckInTime, setFormCheckInTime] = useState<string>('07:00');
  const [formNotes, setFormNotes] = useState<string>('');

  // Selected shift details in modal form (derived from shifts state)
  const currentSelectedShift = useMemo(() => {
    return shifts.find((s) => s.id === formShiftId) || shifts[0];
  }, [shifts, formShiftId]);

  // Filtered attendances list
  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      const matchDate = !filterDate || att.date === filterDate;
      const matchShift = filterShiftId === 'all' || att.shiftId === filterShiftId;
      const matchOperator = filterOperatorId === 'all' || att.operatorId === filterOperatorId;
      const matchStatus = filterStatus === 'all' || att.status === filterStatus;
      return matchDate && matchShift && matchOperator && matchStatus;
    });
  }, [attendances, filterDate, filterShiftId, filterOperatorId, filterStatus]);

  // Metrics calculation
  const totalHariIni = attendances.filter((a) => a.date === filterDate).length;
  const hadirHariIni = attendances.filter((a) => a.date === filterDate && a.status === 'Hadir').length;
  const izinSakitHariIni = attendances.filter(
    (a) => a.date === filterDate && (a.status === 'Izin' || a.status === 'Sakit')
  ).length;

  const handleOpenAddModal = () => {
    setEditingAttendance(null);
    setFormOperatorId(operators[0]?.id || 'OPR-01');
    setFormShiftId(activeShift?.id || shifts[0]?.id || 'SFT-01');
    setFormDate(filterDate || '2026-09-24');
    setFormStatus('Hadir');
    setFormCheckInTime(activeShift?.startTime || shifts[0]?.startTime || '07:00');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (att: Attendance) => {
    setEditingAttendance(att);
    setFormOperatorId(att.operatorId);
    setFormShiftId(att.shiftId);
    setFormDate(att.date);
    setFormStatus(att.status);
    setFormCheckInTime(att.checkInTime || '07:00');
    setFormNotes(att.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveAttendance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const selectedOp = operators.find((o) => o.id === formOperatorId);
    const selectedSft = shifts.find((s) => s.id === formShiftId);

    if (!selectedOp) {
      showToast('Pilih operator yang valid.', 'danger');
      return;
    }

    if (!selectedSft) {
      showToast('Pilih shift kerja yang valid.', 'danger');
      return;
    }

    if (editingAttendance) {
      updateAttendance({
        ...editingAttendance,
        operatorId: selectedOp.id,
        operatorName: selectedOp.name,
        shiftId: selectedSft.id,
        shiftName: selectedSft.name,
        date: formDate,
        status: formStatus,
        checkInTime: formCheckInTime,
        notes: formNotes.trim()
      });
      showToast(`Absensi [${selectedOp.name}] untuk ${selectedSft.name} berhasil diperbarui.`, 'success');
    } else {
      addAttendance({
        operatorId: selectedOp.id,
        operatorName: selectedOp.name,
        shiftId: selectedSft.id,
        shiftName: selectedSft.name,
        date: formDate,
        status: formStatus,
        checkInTime: formCheckInTime,
        notes: formNotes.trim()
      });
      showToast(`Absensi [${selectedOp.name}] untuk ${selectedSft.name} berhasil dicatat.`, 'success');
    }

    setIsModalOpen(false);
  };

  const resetFilters = () => {
    setFilterDate('2026-09-24');
    setFilterShiftId('all');
    setFilterOperatorId('all');
    setFilterStatus('all');
  };

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
    <div style={{ paddingBottom: '32px' }}>
      <PageHeader
        title="Absensi & Kehadiran Operator"
        category="OPERASIONAL SPBU"
        subtitle="Pencatatan kehadiran operasional operator kasir berdasarkan jadwal Shift 1 & Shift 2"
        actions={
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={handleOpenAddModal}
            id="btn-catat-absensi"
            style={{ fontWeight: 600 }}
          >
            + Catat Kehadiran
          </Button>
        }
      />

      {/* METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '18px'
        }}
      >
        <MetricCard
          title="Total Tercatat Hari Ini"
          value={totalHariIni.toString()}
          unit="Pencatatan"
          subtitle={`Tanggal ${filterDate || 'Semua Tanggal'}`}
          icon={Users}
        />
        <MetricCard
          title="Operator Hadir"
          value={hadirHariIni.toString()}
          unit="Orang"
          subtitle="Status Hadir di SPBU"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Izin / Sakit"
          value={izinSakitHariIni.toString()}
          unit="Orang"
          subtitle="Pemberitahuan resmi"
          icon={UserCheck}
        />
        <MetricCard
          title="Jadwal Master Shift"
          value={`${shifts.length} Shift`}
          subtitle="Shift 1 (07:00–15:00) & Shift 2 (15:00–23:00)"
          icon={Clock}
        />
      </div>

      {/* ACTIVE SHIFT CALLOUT */}
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
              : 'Belum ada sesi shift aktif yang dibuka. Buka sesi di menu Monitoring → Shift Kerja.'}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--blue-800)', fontWeight: 500 }}>
          Master Shift: Shift 1 (07:00–15:00) • Shift 2 (15:00–23:00)
        </div>
      </div>

      {/* FILTER CARD */}
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
            <span>Filter Data Absensi</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
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
            <label className="form-label" style={{ fontSize: '12px' }}>Tanggal</label>
            <input
              type="date"
              className="form-control"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ fontSize: '13px' }}
            />
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
            <label className="form-label" style={{ fontSize: '12px' }}>Pegawai / Operator</label>
            <select
              className="form-select"
              value={filterOperatorId}
              onChange={(e) => setFilterOperatorId(e.target.value)}
              style={{ fontSize: '13px' }}
            >
              <option value="all">Semua Operator</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.id})
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

      {/* TABLE DATA ABSENSI */}
      <Card
        title="Daftar Rekap Presensi Operator"
        subtitle={`Menampilkan ${filteredAttendances.length} catatan kehadiran`}
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
                <th>Operator / Pegawai</th>
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
                  const sftDetail = shifts.find((s) => s.id === att.shiftId);
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
                          <strong style={{ color: 'var(--color-dark-text)' }}>{att.operatorName}</strong>
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
                            {att.operatorId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong style={{ color: 'var(--color-primary-dark)' }}>{att.shiftName}</strong>
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
                          onClick={() => handleOpenEditModal(att)}
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

      {/* OPEN DECISION NOTICE */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 'var(--border-radius-sm)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          fontSize: '12.5px',
          color: '#92400E'
        }}
      >
        <Info size={16} color="#B45309" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Status Kebijakan Operasional (Open Decision):</strong>
          <span style={{ display: 'block', marginTop: '2px', lineHeight: 1.45 }}>
            Status kehadiran (Hadir, Izin, Sakit, Alpa) saat ini berfungsi sebagai pencatatan kehadiran operasional operator SPBU.
            Konsekuensi penggajian, pemotongan upah, atau integrasi payroll belum ditentukan oleh client dan tidak mempengaruhi pembukuan akuntansi.
          </span>
        </div>
      </div>

      {/* MODAL INPUT / EDIT ABSENSI */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAttendance ? 'Ubah Catatan Kehadiran Operator' : 'Catat Kehadiran Operator'}
      >
        <form onSubmit={handleSaveAttendance} id="form-absensi">
          {/* Operator Selection */}
          <div className="form-group">
            <label className="form-label">
              Nama Pegawai / Operator <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={formOperatorId}
              onChange={(e) => setFormOperatorId(e.target.value)}
              required
              id="select-operator"
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  [{op.id}] {op.name} {op.role ? `— ${op.role}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Selection (Driven by master shift state) */}
          <div className="form-group">
            <label className="form-label">
              Pilihan Shift Kerja <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={formShiftId}
              onChange={(e) => {
                const sId = e.target.value;
                setFormShiftId(sId);
                const s = shifts.find((item) => item.id === sId);
                if (s && !editingAttendance) {
                  setFormCheckInTime(s.startTime);
                }
              }}
              required
              id="select-shift"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} ({s.startTime} - {s.endTime} WIB)
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Shift Schedule Card */}
          {currentSelectedShift && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--blue-50)',
                border: '1px solid var(--blue-200)',
                borderRadius: 'var(--border-radius-xs)',
                marginBottom: '14px',
                fontSize: '12.5px',
                color: 'var(--blue-900)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Jam Kerja Shift Terpilih:</span>
                <strong style={{ fontSize: '13px', color: 'var(--color-primary-dark)' }}>
                  {currentSelectedShift.startTime} - {currentSelectedShift.endTime} WIB
                </strong>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                Relasi Shift: {currentSelectedShift.id} ({currentSelectedShift.name})
              </div>
            </div>
          )}

          {/* Date & Check-in Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Tanggal Kehadiran <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
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
                value={formCheckInTime}
                onChange={(e) => setFormCheckInTime(e.target.value)}
                placeholder="Contoh: 07:00"
                required
                id="input-jam-absensi"
              />
            </div>
          </div>

          {/* Attendance Status */}
          <div className="form-group">
            <label className="form-label">
              Status Presensi <span className="required">*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFormStatus(st)}
                  className="btn"
                  id={`status-option-${st.toLowerCase()}`}
                  style={{
                    backgroundColor: formStatus === st ? 'var(--blue-50)' : 'var(--color-white)',
                    borderColor: formStatus === st ? 'var(--color-primary)' : 'var(--color-border)',
                    color: formStatus === st ? 'var(--color-primary-dark)' : 'var(--color-dark-text)',
                    fontWeight: formStatus === st ? 700 : 500,
                    fontSize: '13px',
                    padding: '8px 4px',
                    borderWidth: formStatus === st ? '2px' : '1px'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Catatan / Keterangan</label>
            <input
              type="text"
              className="form-control"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Contoh: Tepat waktu, Tukar shift, Sakit surat dokter"
              id="input-catatan-absensi"
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              id="btn-simpan-absensi"
              style={{ fontWeight: 700 }}
            >
              {editingAttendance ? 'Simpan Perubahan' : 'Catat Presensi'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
