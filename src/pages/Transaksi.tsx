import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/common';
import { Card, Button, Modal, Badge } from '../components/ui';
import {
  Transaction,
  MasterCode,
  Product,
  ToastType,
  StationInfo,
  Tera
} from '../types';
import { useAppContext } from '../context/AppContext';
import { getLocalDateString, getLocalDateTimeString } from '../services/appSettings';

export interface TransaksiPageProps {
  mockData?: {
    mockTransactions: Transaction[];
    mockMasterCodes: MasterCode[];
    mockProducts: Product[];
  };
  stationInfo?: StationInfo;
  showToast: (message: string, type?: ToastType) => void;
}

export function TransaksiPage({
  showToast
}: TransaksiPageProps) {
  const {
    masterCodes,
    products,
    nozzles,
    transactions,
    addTransaction,
    addTera,
    activeShift,
    stationInfo,
    businessPartners,
    receivables,
    payables
  } = useAppContext();

  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialStepParam = queryParams?.get('step');
  const initialStepVal = (initialStepParam === '2' || initialStepParam === '3') ? parseInt(initialStepParam) as 2 | 3 : 1;
  const initialCodeParam = queryParams?.get('code') || '';
  const initialMatchedTemplate = initialCodeParam ? masterCodes.find(m => m.code === initialCodeParam) || null : null;
  const initialF1Param = queryParams?.get('f1') === '1';

  // Flow State: 1 = Kode, 2 = Input Data, 3 = Review
  const [step, setStep] = useState<1 | 2 | 3>(initialMatchedTemplate ? initialStepVal : 1);

  // Form States
  const [inputCode, setInputCode] = useState<string>(initialCodeParam);
  const [activeTemplate, setActiveTemplate] = useState<MasterCode | null>(initialMatchedTemplate);
  const [codeError, setCodeError] = useState<string>('');

  // Partner & Settlement States
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>('');
  const [selectedPayableId, setSelectedPayableId] = useState<string>('');

  // Field states for Step 2
  const [selectedNozzleId, setSelectedNozzleId] = useState<string>(nozzles[0]?.id || 'NZL-01');
  const [teraAwal, setTeraAwal] = useState<string>(nozzles[0]?.currentMeter?.toString() || '0');
  const [teraAkhir, setTeraAkhir] = useState<string>('');
  const [nominalInput, setNominalInput] = useState<string>('');
  const [keteranganInput, setKeteranganInput] = useState<string>('');

  // F1 Search Modal
  const [showF1Modal, setShowF1Modal] = useState<boolean>(initialF1Param);
  const [f1Query, setF1Query] = useState<string>('');

  // Search filter for recent transactions
  const [historySearch, setHistorySearch] = useState<string>('');

  // Input refs for auto-focus
  const codeInputRef = useRef<HTMLInputElement>(null);
  const teraAkhirRef = useRef<HTMLInputElement>(null);
  const nominalRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (step === 1 && !showF1Modal) {
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } else if (step === 2) {
      if (activeTemplate?.requiresTera) {
        setTimeout(() => teraAkhirRef.current?.focus(), 50);
      } else {
        setTimeout(() => nominalRef.current?.focus(), 50);
      }
    }
  }, [step, showF1Modal, activeTemplate]);

  const handleCancel = () => {
    setStep(1);
    setInputCode('');
    setActiveTemplate(null);
    setCodeError('');
    setNominalInput('');
    setKeteranganInput('');
    setSelectedPartnerId('');
    setSelectedReceivableId('');
    setSelectedPayableId('');
  };

  // Global Keyboard Shortcuts (F1, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowF1Modal((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showF1Modal) {
          setShowF1Modal(false);
        } else if (step === 2 || step === 3) {
          handleCancel();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showF1Modal, step]);

  // Handler: Proses Kode Transaksi
  const handleProcessCode = (codeToProcess: string) => {
    if (!activeShift) {
      showToast('Belum ada shift aktif. Buka shift terlebih dahulu.', 'danger');
      return;
    }

    const cleanCode = codeToProcess.trim();
    if (!cleanCode) {
      setCodeError('Masukkan kode transaksi.');
      return;
    }

    const found = masterCodes.find(
      (m) => m.code.toLowerCase() === cleanCode.toLowerCase() && m.isActive
    );

    if (found) {
      setActiveTemplate(found);
      setCodeError('');

      // Auto-initalize partner / tagihan selection
      if (found.paymentMethod === 'Piutang') {
        const defCust = businessPartners.find(p => p.type === 'Customer');
        if (defCust) setSelectedPartnerId(defCust.id);
      } else if (found.paymentMethod === 'Hutang') {
        const defVend = businessPartners.find(p => p.type === 'Vendor');
        if (defVend) setSelectedPartnerId(defVend.id);
      } else if (found.code === '312' || found.category === 'Pelunasan') {
        const openRec = receivables.find(r => r.status !== 'Paid');
        if (openRec) {
          setSelectedReceivableId(openRec.id);
          setSelectedPartnerId(openRec.partnerId);
          setNominalInput(openRec.outstanding.toString());
        }
      } else if (found.code === '315') {
        const openPay = payables.find(p => p.status !== 'Paid');
        if (openPay) {
          setSelectedPayableId(openPay.id);
          setSelectedPartnerId(openPay.partnerId);
          setNominalInput(openPay.outstanding.toString());
        }
      }

      if (found.requiresTera) {
        // Find matching nozzle for this product
        const matchedNzl = nozzles.find(n => n.productId === found.productId || (n.productName && found.product && n.productName.includes(found.product))) || nozzles[0];
        if (matchedNzl) {
          setSelectedNozzleId(matchedNzl.id);
          setTeraAwal(matchedNzl.currentMeter.toString());
          setTeraAkhir('');
        } else {
          setTeraAwal('0');
          setTeraAkhir('');
        }
      } else {
        if (found.code !== '312' && found.code !== '315') {
          setNominalInput('');
        }
        setKeteranganInput('');
      }
      setStep(2);
    } else {
      setCodeError(`Kode "${cleanCode}" tidak ditemukan atau nonaktif. Tekan F1 untuk mencari.`);
    }
  };

  const handleSelectCode = (code: string) => {
    setInputCode(code);
    setShowF1Modal(false);
    handleProcessCode(code);
  };

  // Perhitungan dinamis Tera
  const numTeraAwal = parseFloat(teraAwal) || 0;
  const numTeraAkhir = parseFloat(teraAkhir) || 0;
  const computedTeraVolume = Math.max(0, parseFloat((numTeraAkhir - numTeraAwal).toFixed(2)));
  const matchedProductObj = products.find(p => p.id === activeTemplate?.productId || p.name.includes(activeTemplate?.product || ''));
  const unitPrice = activeTemplate?.unitPrice || matchedProductObj?.sellPrice || 0;
  const computedTeraTotal = computedTeraVolume * unitPrice;

  // Total nominal akhir transaksi
  const finalTotal = activeTemplate?.requiresTera
    ? computedTeraTotal
    : parseFloat(nominalInput) || 0;

  // Lanjut dari Step 2 ke Step 3 (Review)
  const handleProceedToReview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (activeTemplate?.requiresTera) {
      if (!teraAkhir || numTeraAkhir <= numTeraAwal) {
        showToast('Tera Akhir wajib diisi dan harus lebih besar dari Tera Awal.', 'danger');
        return;
      }
    } else {
      if (!nominalInput || parseFloat(nominalInput) <= 0) {
        showToast('Masukkan nominal transaksi yang valid.', 'danger');
        return;
      }
    }

    const isPelunasanPiutang = activeTemplate?.code === '312' || (activeTemplate?.category === 'Pelunasan' && (activeTemplate.creditAccountId === '1-1101' || activeTemplate.creditAccountId === 'ACC-03'));
    const isPembayaranHutang = activeTemplate?.code === '315' || (activeTemplate?.category === 'Pelunasan' && (activeTemplate.debitAccountId === '2-1001' || activeTemplate.debitAccountId === 'ACC-06'));

    if (isPelunasanPiutang && !selectedReceivableId) {
      showToast('Pilih faktur piutang yang ingin dilunasi terlebih dahulu.', 'danger');
      return;
    }

    if (isPembayaranHutang && !selectedPayableId) {
      showToast('Pilih tagihan hutang yang ingin dibayar terlebih dahulu.', 'danger');
      return;
    }

    setStep(3);
  };

  // Simpan Transaksi & Auto-focus kembali ke input kode
  const handleSaveTransaction = () => {
    if (!activeTemplate) return;
    if (!activeShift) {
      showToast('Belum ada shift aktif. Buka shift terlebih dahulu.', 'danger');
      return;
    }

    const isPelunasanPiutang = activeTemplate.code === '312' || (activeTemplate.category === 'Pelunasan' && (activeTemplate.creditAccountId === '1-1101' || activeTemplate.creditAccountId === 'ACC-03'));
    const isPembayaranHutang = activeTemplate.code === '315' || (activeTemplate.category === 'Pelunasan' && (activeTemplate.debitAccountId === '2-1001' || activeTemplate.debitAccountId === 'ACC-06'));

    if (isPelunasanPiutang && !selectedReceivableId) {
      showToast('Pilih faktur piutang yang ingin dilunasi.', 'danger');
      return;
    }

    if (isPembayaranHutang && !selectedPayableId) {
      showToast('Pilih tagihan hutang yang ingin dibayar.', 'danger');
      return;
    }

    const txId = `TX-${Date.now().toString().slice(-6)}`;
    const currentNzl = nozzles.find(n => n.id === selectedNozzleId) || nozzles[0];
    let createdTeraId: string | undefined = undefined;

    // Relasi Tera (Requirement H)
    if (activeTemplate.requiresTera && currentNzl) {
      createdTeraId = `TRA-${Date.now().toString().slice(-4)}`;
      const newTera: Tera = {
        id: createdTeraId,
        date: getLocalDateString(),
        shiftId: activeShift.id,
        shift: activeShift.name,
        nozzleId: currentNzl.id,
        nozzleCode: currentNzl.code,
        productId: activeTemplate.productId || currentNzl.productId,
        productName: activeTemplate.product || currentNzl.productName || 'BBM',
        price: unitPrice,
        teraAwal: numTeraAwal,
        teraAkhir: numTeraAkhir,
        volume: computedTeraVolume,
        selisih: 0,
        salesAmount: computedTeraTotal,
        officer: activeShift.operator,
        status: 'Valid',
        transactionId: txId
      };
      addTera(newTera);
    }

    const matchedPartner = businessPartners.find(p => p.id === selectedPartnerId);

    const newTx: Transaction = {
      id: txId,
      date: getLocalDateTimeString(),
      code: activeTemplate.code,
      masterCodeId: activeTemplate.id,
      name: activeTemplate.name,
      category: activeTemplate.category,
      paymentMethod: activeTemplate.paymentMethod || 'Tunai',
      partnerId: matchedPartner?.id,
      partnerName: matchedPartner?.name,
      relatedReceivableId: selectedReceivableId || undefined,
      relatedPayableId: selectedPayableId || undefined,
      amount: finalTotal,
      productId: activeTemplate.productId,
      product: activeTemplate.product || '-',
      volume: activeTemplate.requiresTera ? computedTeraVolume : 0,
      unitPrice: unitPrice,
      total: finalTotal,
      shiftId: activeShift.id,
      shift: activeShift.name,
      cashier: activeShift.operator,
      status: 'Selesai',
      nozzleId: activeTemplate.requiresTera ? currentNzl?.id : undefined,
      teraId: createdTeraId,
      teraAwal: activeTemplate.requiresTera ? numTeraAwal : undefined,
      teraAkhir: activeTemplate.requiresTera ? numTeraAkhir : undefined
    };

    const postResult = addTransaction(newTx);
    if (!postResult.success) {
      showToast(postResult.error || 'Gagal posting transaksi.', 'danger');
      return;
    }

    showToast(`Transaksi #${activeTemplate.code} berhasil disimpan & diposting ke Jurnal ${postResult.journal?.id || ''}.`, 'success');

    handleCancel();
  };

  // Quick Codes (Shortcut umum SPBU)
  const quickCodes = [
    { code: '303', label: 'Pertalite Tunai' },
    { code: '310', label: 'Pertalite Kredit (Piutang)' },
    { code: '312', label: 'Pelunasan Piutang' },
    { code: '304', label: 'Pertamax Tunai' },
    { code: '309', label: 'Bio Solar Tunai' },
    { code: '308', label: 'DO Pertamina (Bank)' },
    { code: '313', label: 'Beli Tunai Kas' },
    { code: '314', label: 'Beli Hutang' },
    { code: '315', label: 'Bayar Hutang' }
  ];

  const filteredHistory = transactions.filter((tx) =>
    tx.code.includes(historySearch) ||
    tx.name.toLowerCase().includes(historySearch.toLowerCase()) ||
    tx.id.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Transaksi"
        subtitle={`Alur: Kode Transaksi → Template → Input Data → Review → Simpan • ${activeShift ? activeShift.name : 'Belum Ada Shift'}`}
        actions={
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: 'var(--color-muted-text)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              padding: '4px 10px',
              borderRadius: 'var(--border-radius-xs)'
            }}
          >
            <span>Navigasi Cepat:</span>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--blue-50)', border: '1px solid var(--blue-200)', color: 'var(--color-primary-dark)', fontWeight: 700 }}>Enter</kbd> Lanjut
            <span>•</span>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--blue-50)', border: '1px solid var(--blue-200)', color: 'var(--color-primary-dark)', fontWeight: 700 }}>F1</kbd> Cari
            <span>•</span>
            <kbd style={{ padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--blue-50)', border: '1px solid var(--blue-200)', color: 'var(--color-primary-dark)', fontWeight: 700 }}>Esc</kbd> Batal
          </div>
        }
      />

      {/* WORKSTATION CARD */}
      <Card style={{ marginBottom: '24px' }}>
        {/* Guard prototype behavior jika belum ada shift aktif */}
        {!activeShift && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#FEF2F2',
              border: '1.5px solid #FCA5A5',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '13.5px' }}>
                Belum ada shift aktif. Buka shift terlebih dahulu.
              </div>
              <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                Transaksi memerlukan sesi shift kerja aktif untuk mencatat relasi shiftId dan serah terima kas kasir. Silakan buka shift pada modul Pegawai → Shift Kerja.
              </div>
            </div>
          </div>
        )}

        {/* Proper Application Stepper */}
        <div className="stepper-container">
          <div className={`step-item ${step === 1 ? 'active' : step > 1 ? 'completed' : 'inactive'}`}>
            <span className="step-badge">{step > 1 ? '✓' : '1'}</span>
            <span className="step-label">1. Kode Transaksi</span>
          </div>

          <div className={`step-divider ${step > 1 ? 'active' : ''}`} />

          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : 'inactive'}`}>
            <span className="step-badge">{step > 2 ? '✓' : '2'}</span>
            <span className="step-label">2. Input Data</span>
          </div>

          <div className={`step-divider ${step > 2 ? 'active' : ''}`} />

          <div className={`step-item ${step === 3 ? 'active' : 'inactive'}`}>
            <span className="step-badge">3</span>
            <span className="step-label">3. Review & Simpan</span>
          </div>
        </div>

        {/* STEP 1: INPUT KODE TRANSAKSI (COMMAND AREA) */}
        {step === 1 && (
          <div className="tx-command-box" style={{ opacity: activeShift ? 1 : 0.65 }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessCode(inputCode);
              }}
            >
              <div className="form-group" style={{ maxWidth: '580px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    className="form-label"
                    htmlFor="tx-code-input"
                    style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)' }}
                  >
                    KODE TRANSAKSI
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-muted-text)' }}>
                    Ketik kode numerik master transaksi
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-primary)',
                        fontWeight: 800,
                        fontSize: '17px'
                      }}
                    >
                      #
                    </span>
                    <input
                      id="tx-code-input"
                      ref={codeInputRef}
                      type="text"
                      className="form-control"
                      style={{
                        paddingLeft: '34px',
                        fontSize: '17px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        letterSpacing: '1px',
                        backgroundColor: '#FFFFFF',
                        borderColor: codeError ? 'var(--color-danger)' : 'var(--blue-300)',
                        boxShadow: codeError ? '0 0 0 3px rgba(211, 47, 47, 0.15)' : undefined
                      }}
                      placeholder="Contoh: 303"
                      value={inputCode}
                      onChange={(e) => {
                        setInputCode(e.target.value);
                        setCodeError('');
                      }}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowF1Modal(true)}
                    style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Search size={14} color="var(--color-primary)" />
                    <span>F1 Cari</span>
                  </Button>

                  <Button type="submit" variant="primary" style={{ padding: '0 22px', fontWeight: 700 }}>
                    Lanjut
                  </Button>
                </div>

                {codeError ? (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--border-radius-xs)',
                      backgroundColor: 'var(--color-danger-subtle)',
                      border: '1px solid var(--color-danger-border)',
                      color: 'var(--color-danger)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {codeError}
                  </div>
                ) : (
                  <span className="form-hint" style={{ marginTop: '6px' }}>
                    Tekan Enter untuk memuat template transaksi & akun debit/kredit
                  </span>
                )}
              </div>
            </form>

            {/* Quick Codes (Restrained Keyboard Chips) */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--color-muted-text)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Kode Cepat Populer:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickCodes.map((qc) => (
                  <button
                    key={qc.code}
                    type="button"
                    onClick={() => handleSelectCode(qc.code)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: 'var(--shadow-xs)',
                      transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--blue-50)';
                      e.currentTarget.style.borderColor = 'var(--blue-300)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary-dark)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '11.5px'
                      }}
                    >
                      #{qc.code}
                    </span>
                    <span style={{ color: 'var(--color-dark-text)', fontWeight: 600 }}>{qc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TEMPLATE & INPUT DATA */}
        {step === 2 && activeTemplate && (
          <div>
            {/* Informasi Template Banner */}
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'var(--blue-50)',
                border: '1.5px solid var(--blue-200)',
                borderRadius: 'var(--border-radius-sm)',
                marginBottom: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      backgroundColor: 'var(--color-primary)',
                      color: '#FFFFFF',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    #{activeTemplate.code}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-dark-text)' }}>
                    {activeTemplate.name}
                  </span>
                </div>
                <Badge variant="primary">
                  {activeTemplate.category}
                </Badge>
              </div>

              {/* Jurnal Otomatis */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--blue-200)',
                  fontSize: '12.5px'
                }}
              >
                <div>
                  <span className="text-muted" style={{ fontWeight: 600 }}>Debit:</span>{' '}
                  <span style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>[{activeTemplate.debitAccountId}] {activeTemplate.debitAccountName}</span>
                </div>
                <div>
                  <span className="text-muted" style={{ fontWeight: 600 }}>Kredit:</span>{' '}
                  <span style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>[{activeTemplate.creditAccountId}] {activeTemplate.creditAccountName}</span>
                </div>
              </div>
            </div>

            {/* Form Input Data */}
            <form onSubmit={handleProceedToReview}>
              {/* Partner / Customer / Vendor selection if paymentMethod is Piutang or Hutang or Pelunasan */}
              {(activeTemplate.paymentMethod === 'Piutang' || activeTemplate.paymentMethod === 'Hutang' || activeTemplate.code === '312' || activeTemplate.code === '315' || activeTemplate.category === 'Pelunasan') && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    marginBottom: '14px'
                  }}
                >
                  {activeTemplate.code === '312' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">
                          Pilih Faktur Piutang yang Dilunasi <span className="required">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={selectedReceivableId}
                          onChange={(e) => {
                            const recId = e.target.value;
                            setSelectedReceivableId(recId);
                            const r = receivables.find(x => x.id === recId);
                            if (r) {
                              setSelectedPartnerId(r.partnerId);
                              setNominalInput(r.outstanding.toString());
                            }
                          }}
                          required
                        >
                          <option value="">-- Pilih Faktur Piutang --</option>
                          {receivables.filter(r => r.status !== 'Paid').map(r => (
                            <option key={r.id} value={r.id}>
                              [{r.id}] {r.partnerName} — Sisa: Rp {r.outstanding.toLocaleString('id-ID')} ({r.status})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Pelanggan (Debitur)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={businessPartners.find(p => p.id === selectedPartnerId)?.name || 'Pilih faktur di samping'}
                          disabled
                        />
                      </div>
                    </div>
                  ) : activeTemplate.code === '315' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">
                          Pilih Tagihan Hutang yang Dibayar <span className="required">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={selectedPayableId}
                          onChange={(e) => {
                            const payId = e.target.value;
                            setSelectedPayableId(payId);
                            const p = payables.find(x => x.id === payId);
                            if (p) {
                              setSelectedPartnerId(p.partnerId);
                              setNominalInput(p.outstanding.toString());
                            }
                          }}
                          required
                        >
                          <option value="">-- Pilih Tagihan Hutang --</option>
                          {payables.filter(p => p.status !== 'Paid').map(p => (
                            <option key={p.id} value={p.id}>
                              [{p.id}] {p.partnerName} — Sisa: Rp {p.outstanding.toLocaleString('id-ID')} ({p.status})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Vendor (Kreditur)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={businessPartners.find(p => p.id === selectedPartnerId)?.name || 'Pilih tagihan di samping'}
                          disabled
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        {activeTemplate.paymentMethod === 'Piutang' ? 'Pelanggan (Penerima Kredit/Piutang)' : 'Vendor (Pemasok Kredit)'}{' '}
                        <span className="required">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Partner --</option>
                        {businessPartners
                          .filter(p => activeTemplate.paymentMethod === 'Piutang' ? p.type === 'Customer' : p.type === 'Vendor')
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              [{p.code}] {p.name} ({p.type})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {activeTemplate.requiresTera ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Nozzle Dispenser (ID & Pulau)</label>
                      <select
                        className="form-select"
                        value={selectedNozzleId}
                        onChange={(e) => {
                          const nid = e.target.value;
                          setSelectedNozzleId(nid);
                          const nz = nozzles.find(n => n.id === nid);
                          if (nz) {
                            setTeraAwal(nz.currentMeter.toString());
                            setTeraAkhir('');
                          }
                        }}
                      >
                        {nozzles
                          .filter(n => !activeTemplate.productId || n.productId === activeTemplate.productId || (n.productName ? n.productName.includes(activeTemplate.product || '') : false))
                          .map((nz) => (
                            <option key={nz.id} value={nz.id}>
                              [{nz.id} • {nz.code}] {nz.productName || 'BBM'} — {nz.island} (Tanki: {nz.tankId})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Produk BBM</label>
                      <input type="text" className="form-control" value={activeTemplate.product || 'Pertalite'} disabled />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Harga Satuan (Rp/L)</label>
                      <input type="text" className="form-control" value={`Rp ${unitPrice.toLocaleString('id-ID')}`} disabled />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tera Awal (Totalisator)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={teraAwal}
                        onChange={(e) => setTeraAwal(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Tera Akhir (Totalisator) <span className="required">*</span>
                      </label>
                      <input
                        ref={teraAkhirRef}
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={teraAkhir}
                        onChange={(e) => setTeraAkhir(e.target.value)}
                        required
                        style={{ borderColor: 'var(--color-primary)', fontWeight: 600 }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Volume Terhitung (L)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={`${computedTeraVolume.toLocaleString('id-ID')} Liter`}
                        disabled
                        style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px 18px',
                      backgroundColor: 'var(--blue-50)',
                      border: '1.5px solid var(--blue-200)',
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-muted-text)' }}>
                      Total Penjualan Terhitung:
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary-dark)' }}>
                      Rp {computedTeraTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Nominal Transaksi (Rp) <span className="required">*</span>
                    </label>
                    <input
                      ref={nominalRef}
                      type="number"
                      min="1000"
                      className="form-control"
                      placeholder="Masukkan nominal angka (misal: 250000)"
                      value={nominalInput}
                      onChange={(e) => setNominalInput(e.target.value)}
                      required
                      style={{ fontSize: '18px', fontWeight: 700, borderColor: 'var(--color-primary)' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Keterangan Tambahan</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Keterangan transaksi (opsional)"
                      value={keteranganInput}
                      onChange={(e) => setKeteranganInput(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons Step 2 */}
              <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Batal [Esc]
                </Button>
                <Button type="submit" variant="primary" style={{ padding: '0 24px', fontWeight: 700 }}>
                  Lanjut ke Review
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: REVIEW & SIMPAN */}
        {step === 3 && activeTemplate && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-dark-text)' }}>
                Konfirmasi Rincian Transaksi
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                Pastikan data transaksi dan jurnal akuntansi telah sesuai sebelum disimpan permanen.
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '16px',
                marginBottom: '18px',
                backgroundColor: '#FFFFFF',
                boxShadow: 'var(--shadow-xs)'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>Kode Transaksi:</span>
                  <div style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--color-primary-dark)', fontSize: '14px', marginTop: '2px' }}>
                    #{activeTemplate.code}
                  </div>
                </div>

                <div>
                  <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>Nama Transaksi:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-dark-text)', marginTop: '2px' }}>
                    {activeTemplate.name}
                  </div>
                </div>

                <div>
                  <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>Shift Kerja:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)', marginTop: '2px' }}>
                    {activeShift ? `[${activeShift.id}] ${activeShift.name}` : '-'}
                  </div>
                </div>

                <div>
                  <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>Total Akhir:</span>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--color-primary-dark)', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                    Rp {finalTotal.toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>Metode / Rekan:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-dark-text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge variant={activeTemplate.paymentMethod === 'Piutang' ? 'warning' : activeTemplate.paymentMethod === 'Hutang' ? 'danger' : 'primary'}>
                      {activeTemplate.paymentMethod || 'Tunai'}
                    </Badge>
                    {selectedPartnerId && (
                      <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {businessPartners.find(p => p.id === selectedPartnerId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeTemplate.requiresTera && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12.5px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    <div><span className="text-muted">Nozzle Dispenser:</span> <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedNozzleId}</span></div>
                    <div><span className="text-muted">Tera Awal:</span> <span style={{ fontWeight: 600 }}>{numTeraAwal.toLocaleString('id-ID')}</span></div>
                    <div><span className="text-muted">Tera Akhir:</span> <span style={{ fontWeight: 600 }}>{numTeraAkhir.toLocaleString('id-ID')}</span></div>
                    <div><span className="text-muted">Volume:</span> <span style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{computedTeraVolume.toLocaleString('id-ID')} L</span></div>
                    <div><span className="text-muted">Tarif:</span> <span style={{ fontWeight: 600 }}>Rp {unitPrice.toLocaleString('id-ID')}/L</span></div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12.5px' }}>
                <span className="text-muted" style={{ display: 'block', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '11.5px' }}>
                  Entri Jurnal Akuntansi Otomatis:
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontWeight: 600 }}>(Debit) [{activeTemplate.debitAccountId}] {activeTemplate.debitAccountName}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rp {finalTotal.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 18px', color: 'var(--color-muted-text)' }}>
                  <span>(Kredit) [{activeTemplate.creditAccountId}] {activeTemplate.creditAccountName}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Rp {finalTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setStep(2)}>
                Koreksi Data
              </Button>
              <Button variant="primary" onClick={handleSaveTransaction} style={{ padding: '0 24px', fontWeight: 700 }}>
                Simpan Transaksi
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* RIWAYAT TRANSAKSI TERAKHIR */}
      <Card
        title="Riwayat Transaksi"
        subtitle={`${activeShift ? activeShift.name : 'Seluruh Sesi'} • ${stationInfo?.id || 'SPBU'}`}
        actions={
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted-text)'
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Cari transaksi..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ paddingLeft: '30px', minHeight: '34px', fontSize: '12.5px' }}
            />
          </div>
        }
      >
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>No. Bukti</th>
                <th>Waktu</th>
                <th>Kode</th>
                <th>Transaksi</th>
                <th>Kategori</th>
                <th className="table-num">Volume</th>
                <th className="table-num">Nominal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: 'var(--color-muted-text)' }}>
                    Belum ada transaksi ditemukan.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-muted-text)' }}>{tx.id}</td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{tx.date.split(' ')[1]}</td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          backgroundColor: 'var(--blue-50)',
                          color: 'var(--color-primary-dark)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border: '1px solid var(--blue-200)',
                          fontSize: '12px'
                        }}
                      >
                        {tx.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>{tx.name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>{tx.category}</td>
                    <td className="table-num">{tx.volume > 0 ? `${tx.volume} L` : '-'}</td>
                    <td className="table-num" style={{ fontWeight: 700, color: 'var(--color-dark-text)' }}>
                      Rp {tx.total.toLocaleString('id-ID')}
                    </td>
                    <td>
                      <Badge variant={tx.status === 'Selesai' ? 'success' : 'neutral'}>
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL F1 SEARCH */}
      <Modal
        isOpen={showF1Modal}
        onClose={() => setShowF1Modal(false)}
        title="Cari Kode Transaksi [F1]"
      >
        <div>
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Ketik kode (misal 303) atau nama transaksi..."
              value={f1Query}
              onChange={(e) => setF1Query(e.target.value)}
              autoFocus
              style={{ fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
            {masterCodes
              .filter(
                (m) =>
                  m.code.includes(f1Query) ||
                  m.name.toLowerCase().includes(f1Query.toLowerCase()) ||
                  m.category.toLowerCase().includes(f1Query.toLowerCase())
              )
              .map((mc) => (
                <button
                  key={mc.id}
                  type="button"
                  onClick={() => handleSelectCode(mc.code)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--blue-50)';
                    e.currentTarget.style.borderColor = 'var(--blue-300)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          backgroundColor: 'var(--color-primary-light)',
                          color: 'var(--color-primary-dark)',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '12px'
                        }}
                      >
                        #{mc.code}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-dark-text)' }}>
                        {mc.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-muted-text)', marginTop: '3px' }}>
                      {mc.description}
                    </div>
                  </div>

                  <Badge variant="primary">
                    {mc.category}
                  </Badge>
                </button>
              ))}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => setShowF1Modal(false)}>
              Tutup [Esc]
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
