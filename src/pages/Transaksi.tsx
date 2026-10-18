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
    payables,
    correctTransaction
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
  const [linkToShift, setLinkToShift] = useState<boolean>(true);

  // F1 Search Modal
  const [showF1Modal, setShowF1Modal] = useState<boolean>(initialF1Param);
  const [f1Query, setF1Query] = useState<string>('');

  // Search filter for recent transactions
  const [historySearch, setHistorySearch] = useState<string>('');

  // Correction Modal States
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctingTx, setCorrectingTx] = useState<Transaction | null>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [replacementNominal, setReplacementNominal] = useState<string>('');
  const [replacementKeterangan, setReplacementKeterangan] = useState<string>('');
  const [replacementCode, setReplacementCode] = useState<string>('');
  const [replacementPartnerId, setReplacementPartnerId] = useState<string>('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState<boolean>(false);

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

  // Koreksi Transaksi Helpers & Handlers
  const checkCorrectionEligibility = (tx: Transaction): { eligible: boolean; reason?: string } => {
    if (tx.status !== 'Selesai') {
      return { eligible: false, reason: `Status transaksi bukan Selesai (status: ${tx.status}).` };
    }
    if (tx.isCorrected) {
      return { eligible: false, reason: 'Transaksi ini sudah pernah dikoreksi sebelumnya.' };
    }
    if (tx.nozzleId || tx.teraId) {
      return { eligible: false, reason: 'Koreksi transaksi dengan tera nozzle belum didukung untuk menjaga konsistensi fisik meteran pompa.' };
    }
    if (tx.category === 'Pelunasan' || tx.relatedReceivableId || tx.relatedPayableId) {
      return { eligible: false, reason: 'Transaksi pelunasan piutang/hutang tidak dapat dikoreksi langsung karena telah memengaruhi saldo tagihan lain.' };
    }
    if (tx.shiftId) {
      if (!activeShift || activeShift.id !== tx.shiftId) {
        return { eligible: false, reason: 'Transaksi berasal dari sesi shift yang sudah ditutup atau tidak aktif. Transaksi pada shift tertutup terkunci.' };
      }
    }
    if (tx.paymentMethod === 'Piutang') {
      const rec = receivables.find(r => r.transactionId === tx.id);
      if (rec && (rec.status !== 'Open' || rec.outstanding < rec.amount)) {
        return { eligible: false, reason: 'Faktur piutang sudah memiliki pembayaran sebagian atau pelunasan.' };
      }
    }
    if (tx.paymentMethod === 'Hutang') {
      const pay = payables.find(p => p.transactionId === tx.id);
      if (pay && (pay.status !== 'Open' || pay.outstanding < pay.amount)) {
        return { eligible: false, reason: 'Faktur hutang sudah memiliki pembayaran sebagian atau pelunasan.' };
      }
    }
    return { eligible: true };
  };

  const handleOpenCorrection = (tx: Transaction) => {
    const eligibility = checkCorrectionEligibility(tx);
    if (!eligibility.eligible) {
      showToast(eligibility.reason || 'Transaksi ini tidak memenuhi syarat untuk dikoreksi.', 'danger');
      return;
    }

    setCorrectingTx(tx);
    setCorrectionReason('');
    setReplacementNominal(tx.total.toString());
    setReplacementKeterangan(tx.name);
    setReplacementCode(tx.code);
    setReplacementPartnerId(tx.partnerId || '');
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = async () => {
    if (!correctingTx) return;
    if (!correctionReason.trim()) {
      showToast('Wajib mengisi alasan koreksi transaksi.', 'danger');
      return;
    }

    const cleanNominal = parseInt(replacementNominal.replace(/[^0-9]/g, ''), 10);
    if (!cleanNominal || cleanNominal <= 0) {
      showToast('Nominal transaksi pengganti harus lebih besar dari 0.', 'danger');
      return;
    }

    const repTemplate = masterCodes.find(m => m.code === replacementCode) || null;
    if (!repTemplate) {
      showToast(`Kode transaksi "${replacementCode}" tidak ditemukan atau tidak aktif.`, 'danger');
      return;
    }

    setIsSubmittingCorrection(true);
    try {
      const replacementTxData: Transaction = {
        ...correctingTx,
        id: '',
        code: repTemplate.code,
        name: replacementKeterangan.trim() || repTemplate.name,
        category: repTemplate.category,
        total: cleanNominal,
        amount: cleanNominal,
        partnerId: replacementPartnerId || correctingTx.partnerId,
        paymentMethod: repTemplate.paymentMethod,
        date: correctingTx.date,
        shiftId: correctingTx.shiftId,
        shift: correctingTx.shift,
        cashier: correctingTx.cashier,
        status: 'Selesai'
      };

      const result = await correctTransaction({
        originalTransactionId: correctingTx.id,
        reason: correctionReason.trim(),
        replacementData: replacementTxData,
        user: stationInfo?.manager || 'Admin SPBU'
      });

      if (!result.success) {
        showToast(result.error || 'Gagal mengoreksi transaksi.', 'danger');
      } else {
        showToast('Koreksi transaksi berhasil. Jurnal pembalik telah dibukukan dan transaksi pengganti diterbitkan.', 'success');
        setShowCorrectionModal(false);
        setCorrectingTx(null);
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || String(err)}`, 'danger');
    } finally {
      setIsSubmittingCorrection(false);
    }
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
        // Jangan otomatis memilih tagihan pertama dan jangan mengisi nominal otomatis saat form baru dibuka
        setSelectedPayableId('');
        setSelectedPartnerId('');
        setNominalInput('');
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

    if (isPembayaranHutang) {
      if (!selectedPartnerId) {
        showToast('Pilih vendor/pemasok terlebih dahulu.', 'danger');
        return;
      }
      if (!selectedPayableId) {
        showToast('Pilih tagihan hutang yang ingin dibayar terlebih dahulu.', 'danger');
        return;
      }
      const pay = payables.find((x) => x.id === selectedPayableId);
      if (!pay) {
        showToast('Tagihan hutang tidak ditemukan.', 'danger');
        return;
      }
      if (pay.status === 'Paid' || pay.outstanding <= 0) {
        showToast('Tagihan hutang ini sudah lunas (Paid).', 'danger');
        return;
      }
      const nominal = parseFloat(nominalInput) || 0;
      if (nominal <= 0) {
        showToast('Nominal pembayaran harus lebih besar dari nol.', 'danger');
        return;
      }
      if (nominal > pay.outstanding) {
        showToast(`Nominal pembayaran (Rp ${nominal.toLocaleString('id-ID')}) tidak boleh melebihi sisa hutang (Rp ${pay.outstanding.toLocaleString('id-ID')}).`, 'danger');
        return;
      }
    }

    setStep(3);
  };

  // Simpan Transaksi & Auto-focus kembali ke input kode
  const handleSaveTransaction = async () => {
    if (!activeTemplate) return;

    const isShiftLinked = Boolean(activeShift && linkToShift);
    const txShiftId = isShiftLinked && activeShift ? activeShift.id : undefined;
    const txShiftName = isShiftLinked && activeShift ? activeShift.name : 'Tanpa Sesi / Administratif';
    const txCashier = isShiftLinked && activeShift ? activeShift.operator : 'Admin SPBU';

    const isPelunasanPiutang = activeTemplate.code === '312' || (activeTemplate.category === 'Pelunasan' && (activeTemplate.creditAccountId === '1-1101' || activeTemplate.creditAccountId === 'ACC-03'));
    const isPembayaranHutang = activeTemplate.code === '315' || (activeTemplate.category === 'Pelunasan' && (activeTemplate.debitAccountId === '2-1001' || activeTemplate.debitAccountId === 'ACC-06'));

    if (isPelunasanPiutang && !selectedReceivableId) {
      showToast('Pilih faktur piutang yang ingin dilunasi.', 'danger');
      return;
    }

    if (isPembayaranHutang) {
      if (!selectedPartnerId) {
        showToast('Pilih vendor/pemasok terlebih dahulu.', 'danger');
        return;
      }
      if (!selectedPayableId) {
        showToast('Pilih tagihan hutang yang ingin dibayar.', 'danger');
        return;
      }
      const pay = payables.find((x) => x.id === selectedPayableId);
      if (!pay) {
        showToast('Tagihan hutang tidak ditemukan.', 'danger');
        return;
      }
      if (pay.status === 'Paid' || pay.outstanding <= 0) {
        showToast('Tagihan hutang ini sudah lunas (Paid).', 'danger');
        return;
      }
      if (finalTotal <= 0) {
        showToast('Nominal pembayaran harus lebih besar dari nol.', 'danger');
        return;
      }
      if (finalTotal > pay.outstanding) {
        showToast(`Nominal pembayaran (Rp ${finalTotal.toLocaleString('id-ID')}) tidak boleh melebihi sisa hutang (Rp ${pay.outstanding.toLocaleString('id-ID')}).`, 'danger');
        return;
      }
    }

    const txId = `TX-${Date.now().toString().slice(-6)}`;
    const currentNzl = nozzles.find(n => n.id === selectedNozzleId) || nozzles[0];
    let createdTeraId: string | undefined = undefined;
    let newTera: Tera | undefined = undefined;

    // Relasi Tera (Requirement H)
    if (activeTemplate.requiresTera && currentNzl) {
      createdTeraId = `TRA-${Date.now().toString().slice(-4)}`;
      newTera = {
        id: createdTeraId,
        date: getLocalDateString(),
        shiftId: txShiftId,
        shift: txShiftName,
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
        officer: txCashier,
        status: 'Valid',
        transactionId: txId
      };
      await addTera(newTera);
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
      shiftId: txShiftId,
      shift: txShiftName,
      cashier: txCashier,
      status: 'Selesai',
      nozzleId: activeTemplate.requiresTera ? currentNzl?.id : undefined,
      teraId: createdTeraId,
      teraAwal: activeTemplate.requiresTera ? numTeraAwal : undefined,
      teraAkhir: activeTemplate.requiresTera ? numTeraAkhir : undefined
    };

    const postResult = await addTransaction(newTx, newTera);
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
        subtitle={`Alur: Kode Transaksi → Template → Input Data → Review → Simpan • ${activeShift ? activeShift.name : 'Mode Administratif (Tanpa Shift)'}`}
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
        {/* Banner Status Sesi Shift / Administratif */}
        {!activeShift ? (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#F0F9FF',
              border: '1.5px solid #BAE6FD',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '20px' }}>ℹ️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#0369A1', fontSize: '13.5px' }}>
                Mode Transaksi Administratif (Tanpa Shift Aktif)
              </div>
              <div style={{ fontSize: '12px', color: '#0284C7', marginTop: '2px' }}>
                Tidak ada shift kerja berjalan. Transaksi akan langsung dibukukan ke jurnal akuntansi sebagai transaksi administratif tanpa mengganggu rekonsiliasi kasir.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
              <span>Shift Aktif: <strong>[{activeShift.id}] {activeShift.name}</strong> (Operator: {activeShift.operator})</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={linkToShift}
                onChange={(e) => setLinkToShift(e.target.checked)}
              />
              <span style={{ fontWeight: 600, color: linkToShift ? 'var(--color-primary-dark)' : 'var(--color-muted-text)' }}>
                Tautkan transaksi ke shift ini
              </span>
            </label>
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
          <div className="tx-command-box">
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
                  ) : activeTemplate.code === '315' ? (() => {
                    const selectedVendor = businessPartners.find(p => p.id === selectedPartnerId);
                    // Filter tagihan milik vendor tersebut dengan sisa utang > 0 dan status Open atau Partial
                    const vendorPayables = selectedPartnerId
                      ? payables.filter(
                          p => (p.partnerId === selectedPartnerId ||
                                (selectedVendor && (p.partnerId === selectedVendor.code || p.partnerName.toLowerCase() === selectedVendor.name.toLowerCase()))) &&
                               p.outstanding > 0 &&
                               (p.status === 'Open' || p.status === 'Partial')
                        )
                      : [];

                    const activePayable = payables.find(x => x.id === selectedPayableId);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                          {/* A. Pilih Vendor/Pemasok */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">
                              Vendor/Pemasok (Pihak yang Menerima Pembayaran) <span className="required">*</span>
                            </label>
                            <select
                              className="form-select"
                              value={selectedPartnerId}
                              onChange={(e) => {
                                const newPartnerId = e.target.value;
                                setSelectedPartnerId(newPartnerId);
                                setSelectedPayableId('');
                                setNominalInput('');
                              }}
                              required
                            >
                              <option value="">-- Pilih Vendor/Pemasok --</option>
                              {businessPartners
                                .filter(p => p.type === 'Vendor' && p.isActive !== false)
                                .map((p) => {
                                  const count = payables.filter(
                                    pay => (pay.partnerId === p.id || pay.partnerId === p.code || pay.partnerName.toLowerCase() === p.name.toLowerCase()) &&
                                           pay.outstanding > 0 &&
                                           (pay.status === 'Open' || pay.status === 'Partial')
                                  ).length;
                                  return (
                                    <option key={p.id} value={p.id}>
                                      [{p.code}] {p.name} {count > 0 ? `(${count} tagihan belum lunas)` : '— (Tidak ada tagihan)'}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>

                          {/* B. Pilih Tagihan */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">
                              Pilih Hutang/Tagihan <span className="required">*</span>
                            </label>
                            <select
                              className="form-select"
                              value={selectedPayableId}
                              disabled={!selectedPartnerId || vendorPayables.length === 0}
                              onChange={(e) => {
                                const payId = e.target.value;
                                setSelectedPayableId(payId);
                                const p = payables.find(x => x.id === payId);
                                if (p) {
                                  setNominalInput(p.outstanding.toString());
                                } else {
                                  setNominalInput('');
                                }
                              }}
                              required
                            >
                              <option value="">
                                {!selectedPartnerId
                                  ? '-- Pilih vendor/pemasok dahulu --'
                                  : vendorPayables.length === 0
                                  ? '-- Tidak ada tagihan belum lunas --'
                                  : '-- Pilih Hutang/Tagihan --'}
                              </option>
                              {vendorPayables.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.id}] {p.date ? `${p.date} • ` : ''}Awal: Rp {p.amount.toLocaleString('id-ID')} • Sisa: Rp {p.outstanding.toLocaleString('id-ID')} ({p.status})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Pesan jika vendor tidak memiliki tagihan belum lunas */}
                        {selectedPartnerId && vendorPayables.length === 0 && (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: '#FEF3C7',
                              border: '1px solid #FCD34D',
                              borderRadius: 'var(--border-radius-sm)',
                              color: '#92400E',
                              fontSize: '12.5px'
                            }}
                          >
                            ⚠️ Vendor <strong>{selectedVendor?.name || 'ini'}</strong> saat ini tidak memiliki tagihan hutang yang belum lunas (seluruh kewajiban telah lunas atau belum ada tagihan).
                          </div>
                        )}

                        {/* Ringkasan Tagihan Terpilih */}
                        {activePayable && (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: 'var(--border-radius-sm)',
                              fontSize: '12.5px'
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--color-primary-dark)' }}>
                              Rincian Tagihan Hutang yang Dipilih:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                              <div>
                                <span style={{ color: 'var(--color-muted-text)' }}>No. ID / Referensi:</span>{' '}
                                <strong>{activePayable.id}</strong> {activePayable.transactionId ? `(${activePayable.transactionId})` : ''}
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-muted-text)' }}>Tanggal Tagihan:</span>{' '}
                                <strong>{activePayable.date || '-'}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-muted-text)' }}>Nilai Tagihan Awal:</span>{' '}
                                <strong>Rp {activePayable.amount.toLocaleString('id-ID')}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-muted-text)' }}>Sisa Utang:</span>{' '}
                                <strong style={{ color: 'var(--color-danger)' }}>Rp {activePayable.outstanding.toLocaleString('id-ID')}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-muted-text)' }}>Status Tagihan:</span>{' '}
                                <Badge variant={activePayable.status === 'Partial' ? 'primary' : 'warning'}>
                                  {activePayable.status === 'Partial' ? 'Sebagian (Partial)' : 'Belum Lunas (Open)'}
                                </Badge>
                              </div>
                            </div>
                            {activePayable.notes && (
                              <div style={{ marginTop: '6px', color: 'var(--color-muted-text)' }}>
                                Keterangan: {activePayable.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
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
                  {activeTemplate.code === '315' && selectedPayableId && (() => {
                    const p = payables.find(x => x.id === selectedPayableId);
                    if (!p) return null;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ color: '#1E40AF' }}>
                          Sisa Utang yang Harus Dibayar: <strong style={{ color: 'var(--color-danger)' }}>Rp {p.outstanding.toLocaleString('id-ID')}</strong> (Maksimum)
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setNominalInput(p.outstanding.toString())}
                          style={{ padding: '2px 10px', fontSize: '12px' }}
                        >
                          Lunasi Penuh
                        </Button>
                      </div>
                    );
                  })()}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      {activeTemplate.code === '315' ? 'Nominal Pembayaran (Rp)' : 'Nominal Transaksi (Rp)'}{' '}
                      <span className="required">*</span>
                    </label>
                    <input
                      ref={nominalRef}
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder={activeTemplate.code === '315' ? 'Masukkan nominal pembayaran (bisa sebagian atau penuh)' : 'Masukkan nominal angka (misal: 250000)'}
                      value={nominalInput}
                      onChange={(e) => setNominalInput(e.target.value)}
                      required
                      style={{ fontSize: '18px', fontWeight: 700, borderColor: 'var(--color-primary)' }}
                    />
                    {activeTemplate.code === '315' && (
                      <span style={{ fontSize: '12px', color: 'var(--color-muted-text)', marginTop: '4px', display: 'block' }}>
                        * Anda dapat mengedit nominal untuk pembayaran sebagian atau klik tombol &quot;Lunasi Penuh&quot;.
                      </span>
                    )}
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

              {/* Tautan Shift atau Transaksi Administratif */}
              {activeShift ? (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: '12.5px' }}>
                    <span>Sesi Shift Aktif: <strong>[{activeShift.id}] {activeShift.name}</strong></span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={linkToShift}
                      onChange={(e) => setLinkToShift(e.target.checked)}
                    />
                    <span style={{ fontWeight: 600, color: linkToShift ? 'var(--color-primary-dark)' : 'var(--color-muted-text)' }}>
                      Tautkan ke shift ini
                    </span>
                  </label>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 14px',
                    backgroundColor: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: '12.5px',
                    color: '#0369A1'
                  }}
                >
                  ℹ️ Transaksi ini akan dibukukan sebagai <strong>Transaksi Tanpa Sesi / Administratif</strong>.
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
                    {activeShift && linkToShift ? `[${activeShift.id}] ${activeShift.name} (${activeShift.operator})` : 'Tanpa Sesi / Administratif'}
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
              {selectedPayableId && (() => {
                const pay = payables.find(p => p.id === selectedPayableId);
                if (!pay) return null;
                const sisaSetelahBayar = Math.max(0, pay.outstanding - finalTotal);
                return (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12.5px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      <div><span className="text-muted">Tagihan yang Dibayar:</span> <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{pay.id}</span></div>
                      <div><span className="text-muted">Sisa Utang Sebelum:</span> <span style={{ fontWeight: 600 }}>Rp {pay.outstanding.toLocaleString('id-ID')}</span></div>
                      <div><span className="text-muted">Nominal Dibayar:</span> <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>Rp {finalTotal.toLocaleString('id-ID')}</span></div>
                      <div><span className="text-muted">Sisa Utang Sesudah:</span> <span style={{ fontWeight: 700, color: sisaSetelahBayar === 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>Rp {sisaSetelahBayar.toLocaleString('id-ID')} ({sisaSetelahBayar === 0 ? 'LUNAS' : 'SEBAGIAN'})</span></div>
                    </div>
                  </div>
                );
              })()}

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
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--color-muted-text)' }}>
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
                      {tx.isCorrected ? (
                        <span title={`Dibatalkan & Dibalik: ${tx.cancelReason || '-'}`}>
                          <Badge variant="danger">
                            Terkoreksi
                          </Badge>
                        </span>
                      ) : tx.status === 'Batal' ? (
                        <Badge variant="neutral">Batal</Badge>
                      ) : (
                        <Badge variant="success">Selesai</Badge>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {tx.isCorrected || tx.status === 'Batal' ? (
                        <span style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>-</span>
                      ) : (
                        (() => {
                          const elig = checkCorrectionEligibility(tx);
                          return (
                            <Button
                              size="sm"
                              variant={elig.eligible ? 'outline-primary' : 'secondary'}
                              onClick={() => handleOpenCorrection(tx)}
                              style={{
                                fontSize: '11.5px',
                                padding: '2px 8px',
                                borderColor: elig.eligible ? 'var(--blue-400)' : 'var(--color-border)',
                                color: elig.eligible ? 'var(--color-primary-dark)' : 'var(--color-muted-text)',
                                cursor: 'pointer',
                                opacity: elig.eligible ? 1 : 0.65
                              }}
                              title={elig.eligible ? 'Koreksi transaksi secara akuntansi' : elig.reason}
                            >
                              {elig.eligible ? 'Koreksi' : 'Terkunci'}
                            </Button>
                          );
                        })()
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL KOREKSI TRANSAKSI ADMINISTRATIF */}
      <Modal
        isOpen={showCorrectionModal && correctingTx !== null}
        onClose={() => {
          if (!isSubmittingCorrection) {
            setShowCorrectionModal(false);
            setCorrectingTx(null);
          }
        }}
        title={`Koreksi Transaksi Akuntansi [${correctingTx?.code || ''}]`}
      >
        {correctingTx && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Ringkasan Transaksi Asal */}
            <div
              style={{
                backgroundColor: 'var(--slate-50)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '12px 14px',
                fontSize: '12.5px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-dark-text)' }}>
                  Ringkasan Transaksi Asal (Akan Dibalik)
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    backgroundColor: 'var(--blue-100)',
                    color: 'var(--color-primary-dark)',
                    padding: '2px 6px',
                    borderRadius: '3px'
                  }}
                >
                  {correctingTx.id}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Kode / Nama:</span>{' '}
                  <strong>{correctingTx.code} - {correctingTx.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Kategori:</span>{' '}
                  <strong>{correctingTx.category}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Tanggal:</span>{' '}
                  <strong>{correctingTx.date}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Nominal Asal:</span>{' '}
                  <strong style={{ color: 'var(--color-primary-dark)' }}>
                    Rp {correctingTx.total.toLocaleString('id-ID')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Metode Bayar:</span>{' '}
                  <strong>{correctingTx.paymentMethod || 'Tunai'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-text)' }}>Sesi Shift:</span>{' '}
                  <strong>{correctingTx.shift || 'Tanpa Sesi / Administratif'}</strong>
                </div>
                {correctingTx.partnerName && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--color-muted-text)' }}>Mitra:</span>{' '}
                    <strong>{correctingTx.partnerName}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Alasan Koreksi */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Alasan Koreksi <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                className="form-control"
                placeholder="Contoh: Salah input nominal belanja ATK kantor, seharusnya Rp 250.000..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={2}
                disabled={isSubmittingCorrection}
                style={{ fontSize: '13px' }}
                autoFocus
              />
            </div>

            {/* 3. Form Transaksi Pengganti */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--blue-200)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '10px', fontSize: '13px' }}>
                Data Transaksi Pengganti (Nilai yang Benar)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Kode Transaksi Pengganti
                  </label>
                  <select
                    className="form-control"
                    value={replacementCode}
                    onChange={(e) => {
                      setReplacementCode(e.target.value);
                      const mc = masterCodes.find(m => m.code === e.target.value);
                      if (mc) {
                        setReplacementKeterangan(mc.name);
                      }
                    }}
                    disabled={isSubmittingCorrection}
                    style={{ fontSize: '13px' }}
                  >
                    {masterCodes
                      .filter((m) => m.isActive && !m.requiresTera && m.category !== 'Pelunasan')
                      .map((mc) => (
                        <option key={mc.id} value={mc.code}>
                          #{mc.code} - {mc.name} ({mc.category} / {mc.paymentMethod})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Keterangan / Nama Transaksi
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={replacementKeterangan}
                    onChange={(e) => setReplacementKeterangan(e.target.value)}
                    disabled={isSubmittingCorrection}
                    style={{ fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Nominal Baru (Rp) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={replacementNominal}
                    onChange={(e) => setReplacementNominal(e.target.value)}
                    disabled={isSubmittingCorrection}
                    min="1"
                    style={{ fontSize: '14px', fontWeight: 700 }}
                  />
                </div>

                {/* Mitra Bisnis jika Piutang atau Hutang */}
                {(() => {
                  const repMc = masterCodes.find(m => m.code === replacementCode);
                  if (repMc?.paymentMethod === 'Piutang' || repMc?.paymentMethod === 'Hutang') {
                    const filteredPartners = businessPartners.filter(p =>
                      repMc.paymentMethod === 'Piutang' ? p.type === 'Customer' : p.type === 'Vendor'
                    );
                    return (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                          Mitra Bisnis ({repMc.paymentMethod === 'Piutang' ? 'Pelanggan' : 'Vendor'})
                        </label>
                        <select
                          className="form-control"
                          value={replacementPartnerId}
                          onChange={(e) => setReplacementPartnerId(e.target.value)}
                          disabled={isSubmittingCorrection}
                          style={{ fontSize: '13px' }}
                        >
                          <option value="">-- Pilih Mitra --</option>
                          {filteredPartners.map((bp) => (
                            <option key={bp.id} value={bp.id}>
                              {bp.code} - {bp.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* 4. Konfirmasi dan Peringatan Akuntansi */}
            <div
              style={{
                backgroundColor: 'var(--amber-50, #fffbeb)',
                border: '1px solid var(--amber-200, #fde68a)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '10px 12px',
                fontSize: '11.5px',
                color: '#92400e',
                lineHeight: 1.5
              }}
            >
              <strong>Ketentuan Audit & Akuntansi:</strong> Transaksi asal ({correctingTx.id}) tidak akan dihapus melainkan ditandai sebagai Terkoreksi/Batal. Sistem akan secara otomatis menerbitkan Jurnal Pembalik (Reversal) untuk menetralkan saldo buku besar, lalu memposting transaksi pengganti dalam satu transaksi database atomik.
            </div>

            {/* 5. Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectingTx(null);
                }}
                disabled={isSubmittingCorrection}
              >
                Batal [Esc]
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitCorrection}
                disabled={isSubmittingCorrection || !correctionReason.trim()}
              >
                {isSubmittingCorrection ? 'Memproses Koreksi...' : 'Simpan & Proses Koreksi'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
