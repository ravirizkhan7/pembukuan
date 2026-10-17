import React, { useState } from 'react';
import { PageHeader } from '../components/common';
import { Card, Button, Modal, Badge } from '../components/ui';
import {
  MasterCode,
  Account,
  Journal,
  ToastType,
  PaymentMethod,
  BusinessPartner
} from '../types';
import { useAppContext } from '../context/AppContext';

export interface AkuntansiPageProps {
  mockData?: {
    mockMasterCodes: MasterCode[];
    mockAccounts: Account[];
    mockJournal: Journal[];
  };
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function AkuntansiPage({
  activeSubTab = 'master_kode',
  showToast
}: AkuntansiPageProps) {
  const {
    accounts,
    addAccount,
    updateAccount,
    toggleAccountStatus,
    deleteAccount,
    masterCodes,
    addMasterCode,
    updateMasterCode,
    toggleMasterCodeStatus,
    deleteMasterCode,
    products,
    journals,
    receivables,
    payables,
    businessPartners,
    addBusinessPartner,
    updateBusinessPartner,
    deleteBusinessPartner,
    transactions
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'master_kode');

  React.useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  // ==========================================
  // STATE: Bagan Akun (COA) CRUD
  // ==========================================
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accCode, setAccCode] = useState<string>('');
  const [accName, setAccName] = useState<string>('');
  const [accCategory, setAccCategory] = useState<Account['category']>('Aset');
  const [accNormalBalance, setAccNormalBalance] = useState<'Debit' | 'Kredit'>('Debit');
  const [accBalance, setAccBalance] = useState<string>('0');
  const [accIsActive, setAccIsActive] = useState<boolean>(true);

  const openAddAccountModal = () => {
    setEditingAccount(null);
    setAccCode('');
    setAccName('');
    setAccCategory('Aset');
    setAccNormalBalance('Debit');
    setAccBalance('0');
    setAccIsActive(true);
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: Account) => {
    setEditingAccount(acc);
    setAccCode(acc.code);
    setAccName(acc.name);
    setAccCategory(acc.category);
    setAccNormalBalance(acc.normalBalance);
    setAccBalance(acc.balance.toString());
    setAccIsActive(acc.isActive);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accCode.trim() || !accName.trim()) {
      showToast('Kode dan Nama Akun wajib diisi.', 'danger');
      return;
    }

    if (editingAccount) {
      updateAccount({
        ...editingAccount,
        code: accCode.trim(),
        name: accName.trim(),
        category: accCategory,
        normalBalance: accNormalBalance,
        balance: parseFloat(accBalance) || 0,
        isActive: accIsActive
      });
      showToast(`Akun [${accCode}] berhasil diperbarui.`, 'success');
    } else {
      // Check for duplicate code
      const exists = accounts.some(a => a.code.toLowerCase() === accCode.trim().toLowerCase());
      if (exists) {
        showToast(`Kode akun ${accCode} sudah digunakan.`, 'danger');
        return;
      }

      addAccount({
        id: accCode.trim(),
        code: accCode.trim(),
        name: accName.trim(),
        category: accCategory,
        normalBalance: accNormalBalance,
        balance: parseFloat(accBalance) || 0,
        isActive: accIsActive
      });
      showToast(`Akun [${accCode}] ${accName} berhasil ditambahkan.`, 'success');
    }

    setIsAccountModalOpen(false);
  };

  const handleToggleAccount = (acc: Account) => {
    toggleAccountStatus(acc.id);
    const nextStatus = acc.isActive ? 'dinonaktifkan' : 'diaktifkan';
    showToast(`Akun [${acc.code}] ${acc.name} ${nextStatus}.`, 'primary');
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus Akun [${acc.code}] ${acc.name} secara permanen? Tindakan ini hanya dapat dilakukan karena akun ini belum memiliki entri jurnal dan tidak digunakan pada Master Kode.`
      )
    ) {
      return;
    }
    try {
      if (deleteAccount) {
        await deleteAccount(acc.id);
        showToast(`Akun [${acc.code}] ${acc.name} berhasil dihapus.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus akun.', 'danger');
    }
  };

  // ==========================================
  // STATE: Master Kode CRUD (Mapping COA & Produk)
  // ==========================================
  const [isMasterCodeModalOpen, setIsMasterCodeModalOpen] = useState<boolean>(false);
  const [editingMasterCode, setEditingMasterCode] = useState<MasterCode | null>(null);
  const [mcCode, setMcCode] = useState<string>('');
  const [mcName, setMcName] = useState<string>('');
  const [mcCategory, setMcCategory] = useState<MasterCode['category']>('Penjualan');
  const [mcProductId, setMcProductId] = useState<string>('');
  const [mcDebitAccId, setMcDebitAccId] = useState<string>(accounts[0]?.id || '1-1001');
  const [mcCreditAccId, setMcCreditAccId] = useState<string>(accounts[12]?.id || '4-1001');
  const [mcRequiresTera, setMcRequiresTera] = useState<boolean>(true);
  const [mcDesc, setMcDesc] = useState<string>('');
  const [mcPaymentMethod, setMcPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [mcIsActive, setMcIsActive] = useState<boolean>(true);

  const openAddMasterCodeModal = () => {
    setEditingMasterCode(null);
    setMcCode('');
    setMcName('');
    setMcCategory('Penjualan');
    setMcProductId(products[0]?.id || '');
    setMcDebitAccId(accounts[0]?.id || '1-1001');
    setMcCreditAccId(accounts[12]?.id || '4-1001');
    setMcRequiresTera(true);
    setMcDesc('');
    setMcPaymentMethod('Tunai');
    setMcIsActive(true);
    setIsMasterCodeModalOpen(true);
  };

  const openEditMasterCodeModal = (mc: MasterCode) => {
    setEditingMasterCode(mc);
    setMcCode(mc.code);
    setMcName(mc.name);
    setMcCategory(mc.category);
    setMcProductId(mc.productId || '');
    setMcDebitAccId(mc.debitAccountId);
    setMcCreditAccId(mc.creditAccountId);
    setMcRequiresTera(mc.requiresTera);
    setMcDesc(mc.description || '');
    setMcPaymentMethod(mc.paymentMethod || 'Tunai');
    setMcIsActive(mc.isActive);
    setIsMasterCodeModalOpen(true);
  };

  const handleSaveMasterCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mcCode.trim() || !mcName.trim()) {
      showToast('Kode dan Nama Transaksi wajib diisi.', 'danger');
      return;
    }

    const debitAcc = accounts.find((a) => a.id === mcDebitAccId);
    const creditAcc = accounts.find((a) => a.id === mcCreditAccId);
    const matchedProd = products.find((p) => p.id === mcProductId);

    if (editingMasterCode) {
      updateMasterCode({
        ...editingMasterCode,
        code: mcCode.trim(),
        name: mcName.trim(),
        category: mcCategory,
        productId: matchedProd ? matchedProd.id : undefined,
        product: matchedProd ? matchedProd.name : undefined,
        unitPrice: matchedProd ? matchedProd.sellPrice : editingMasterCode.unitPrice,
        debitAccountId: mcDebitAccId,
        debitAccountName: debitAcc ? debitAcc.name : 'Kas Utama',
        creditAccountId: mcCreditAccId,
        creditAccountName: creditAcc ? creditAcc.name : 'Pendapatan',
        requiresTera: mcRequiresTera,
        description: mcDesc,
        paymentMethod: mcPaymentMethod,
        isActive: mcIsActive
      });
      showToast(`Master Kode #${mcCode} berhasil diperbarui.`, 'success');
    } else {
      const exists = masterCodes.some(m => m.code.toLowerCase() === mcCode.trim().toLowerCase());
      if (exists) {
        showToast(`Kode transaksi #${mcCode} sudah terdaftar.`, 'danger');
        return;
      }

      addMasterCode({
        code: mcCode.trim(),
        name: mcName.trim(),
        category: mcCategory,
        type: `${mcCategory} Standar`,
        productId: matchedProd ? matchedProd.id : undefined,
        product: matchedProd ? matchedProd.name : undefined,
        unitPrice: matchedProd ? matchedProd.sellPrice : undefined,
        debitAccountId: mcDebitAccId,
        debitAccountName: debitAcc ? debitAcc.name : 'Kas Utama',
        creditAccountId: mcCreditAccId,
        creditAccountName: creditAcc ? creditAcc.name : 'Pendapatan',
        requiresTera: mcRequiresTera,
        description: mcDesc,
        paymentMethod: mcPaymentMethod,
        isActive: mcIsActive
      });
      showToast(`Master Kode #${mcCode} berhasil ditambahkan.`, 'success');
    }

    setIsMasterCodeModalOpen(false);
  };

  const handleToggleMasterCode = (mc: MasterCode) => {
    toggleMasterCodeStatus(mc.id);
    const nextStatus = mc.isActive ? 'dinonaktifkan' : 'diaktifkan';
    showToast(`Master Kode #${mc.code} ${nextStatus}.`, 'primary');
  };

  const handleDeleteMasterCode = async (mc: MasterCode) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus Master Kode #${mc.code} (${mc.name}) secara permanen? Tindakan ini hanya dapat dilakukan karena kode ini belum pernah digunakan pada transaksi operasional.`
      )
    ) {
      return;
    }
    try {
      if (deleteMasterCode) {
        await deleteMasterCode(mc.id);
        showToast(`Master Kode #${mc.code} berhasil dihapus.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus Master Kode.', 'danger');
    }
  };

  // ==========================================
  // STATE: Buku Besar & Jurnal
  // ==========================================
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>(accounts[0]?.id || '1-1001');
  const currentLedgerAcc = accounts.find((a) => a.id === selectedLedgerAccount) || accounts[0] || {
    id: '1-1001',
    code: '1-1001',
    name: 'Kas Utama',
    category: 'Aset',
    normalBalance: 'Debit',
    balance: 0,
    isActive: true
  };

  // ==========================================
  // STATE: Master Mitra Bisnis (Vendor & Pelanggan)
  // ==========================================
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState<boolean>(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [bpCode, setBpCode] = useState<string>('');
  const [bpName, setBpName] = useState<string>('');
  const [bpType, setBpType] = useState<'Customer' | 'Vendor'>('Vendor');
  const [bpPhone, setBpPhone] = useState<string>('');
  const [bpAddress, setBpAddress] = useState<string>('');
  const [bpIsActive, setBpIsActive] = useState<boolean>(true);
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'Semua' | 'Vendor' | 'Customer'>('Semua');
  const [partnerSearch, setPartnerSearch] = useState<string>('');

  const openAddPartnerModal = (defaultType: 'Customer' | 'Vendor' = 'Vendor') => {
    setEditingPartner(null);
    setBpCode('');
    setBpName('');
    setBpType(defaultType);
    setBpPhone('');
    setBpAddress('');
    setBpIsActive(true);
    setIsPartnerModalOpen(true);
  };

  const openEditPartnerModal = (partner: BusinessPartner) => {
    setEditingPartner(partner);
    setBpCode(partner.code);
    setBpName(partner.name);
    setBpType(partner.type);
    setBpPhone(partner.phone || '');
    setBpAddress(partner.address || '');
    setBpIsActive(partner.isActive !== false);
    setIsPartnerModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bpCode.trim() || !bpName.trim()) {
      showToast('Kode dan nama mitra wajib diisi.', 'danger');
      return;
    }

    try {
      if (editingPartner) {
        const dup = businessPartners.some(
          (p) => p.id !== editingPartner.id && p.code.toLowerCase() === bpCode.trim().toLowerCase()
        );
        if (dup) {
          showToast(`Kode mitra ${bpCode} sudah digunakan oleh mitra lain.`, 'danger');
          return;
        }

        await updateBusinessPartner(editingPartner.id, {
          code: bpCode.trim(),
          name: bpName.trim(),
          type: bpType,
          phone: bpPhone.trim() || undefined,
          address: bpAddress.trim() || undefined,
          isActive: bpIsActive
        });
        showToast(`Mitra bisnis [${bpCode}] ${bpName} berhasil diperbarui.`, 'success');
      } else {
        const dup = businessPartners.some(
          (p) => p.code.toLowerCase() === bpCode.trim().toLowerCase()
        );
        if (dup) {
          showToast(`Kode mitra ${bpCode} sudah digunakan.`, 'danger');
          return;
        }

        await addBusinessPartner({
          code: bpCode.trim(),
          name: bpName.trim(),
          type: bpType,
          phone: bpPhone.trim() || undefined,
          address: bpAddress.trim() || undefined,
          isActive: bpIsActive
        });
        showToast(`Mitra bisnis [${bpCode}] ${bpName} berhasil didaftarkan.`, 'success');
      }
      setIsPartnerModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data mitra bisnis.', 'danger');
    }
  };

  const handleTogglePartner = async (partner: BusinessPartner) => {
    try {
      const nextActive = partner.isActive === false ? true : false;
      await updateBusinessPartner(partner.id, { isActive: nextActive });
      showToast(`Mitra [${partner.code}] ${partner.name} ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'primary');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status mitra.', 'danger');
    }
  };

  const handleDeletePartner = async (partner: BusinessPartner) => {
    if (!window.confirm(`Yakin ingin menghapus mitra [${partner.code}] ${partner.name}?`)) {
      return;
    }
    try {
      if (deleteBusinessPartner) {
        await deleteBusinessPartner(partner.id);
        showToast(`Mitra [${partner.code}] ${partner.name} berhasil dihapus.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus mitra bisnis.', 'danger');
    }
  };

  // Header switcher
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'master_kode':
        return {
          title: 'Master Kode Transaksi',
          subtitle: 'Pemetaan kode transaksi ke rekening COA Debit dan Kredit dinamis',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddMasterCodeModal}
            >
              + Tambah Kode
            </Button>
          )
        };
      case 'akun':
        return {
          title: 'Bagan Akun (Chart of Accounts)',
          subtitle: 'Daftar rekening buku besar, klasifikasi akun, dan status aktif',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddAccountModal}
            >
              + Tambah Akun
            </Button>
          )
        };
      case 'jurnal':
        return {
          title: 'Jurnal Umum',
          subtitle: 'Pencatatan kronologis transaksi debet dan kredit',
          actions: null
        };
      case 'buku_besar':
        return {
          title: 'Buku Besar',
          subtitle: 'Rincian mutasi dan saldo per rekening perkiraan',
          actions: null
        };
      case 'buku_bantu':
        return {
          title: 'Buku Pembantu (Piutang & Hutang)',
          subtitle: 'Monitoring tagihan piutang pelanggan, kewajiban hutang supplier, serta master rekanan',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openAddPartnerModal('Vendor')}
            >
              + Tambah Mitra Bisnis
            </Button>
          )
        };
      default:
        return {
          title: 'Akuntansi',
          subtitle: 'Modul Akuntansi SPBU',
          actions: null
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div>
      <PageHeader
        category="Akuntansi"
        title={headerInfo.title}
        subtitle={headerInfo.subtitle}
        actions={headerInfo.actions}
      />

      {/* TAB 1: MASTER KODE (Dinamis dengan selector COA & Produk) */}
      {activeTab === 'master_kode' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Transaksi</th>
                  <th>Kategori</th>
                  <th>Metode</th>
                  <th>Produk Terkait</th>
                  <th>Akun Debit (COA)</th>
                  <th>Akun Kredit (COA)</th>
                  <th>Tera</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {masterCodes.map((m) => {
                  const debitAcc = accounts.find(a => a.id === m.debitAccountId);
                  const creditAcc = accounts.find(a => a.id === m.creditAccountId);
                  const isUsed = transactions.some((t) => t.masterCodeId === m.id || t.code === m.code);
                  return (
                    <tr key={m.id} style={{ opacity: m.isActive ? 1 : 0.65 }}>
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
                          #{m.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ fontSize: '12.5px' }}>{m.category}</td>
                      <td>
                        <Badge variant={m.paymentMethod === 'Piutang' ? 'primary' : m.paymentMethod === 'Hutang' ? 'danger' : 'neutral'}>
                          {m.paymentMethod || 'Tunai'}
                        </Badge>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {m.product ? (
                          <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                            {m.product}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-muted-text)' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>[{debitAcc?.code || m.debitAccountId}]</span>{' '}
                        {debitAcc?.name || m.debitAccountName}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>[{creditAcc?.code || m.creditAccountId}]</span>{' '}
                        {creditAcc?.name || m.creditAccountName}
                      </td>
                      <td>
                        <Badge variant={m.requiresTera ? 'primary' : 'neutral'}>
                          {m.requiresTera ? 'Tera' : 'Non-Tera'}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={m.isActive ? 'success' : 'neutral'}>
                          {m.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditMasterCodeModal(m)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={m.isActive ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleMasterCode(m)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                          {!isUsed && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteMasterCode(m)}
                              style={{ padding: '3px 8px', fontSize: '12px' }}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: BAGAN AKUN (COA) - CRUD PENUH */}
      {activeTab === 'akun' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nomor Akun</th>
                  <th>Nama Akun</th>
                  <th>Kategori</th>
                  <th>Saldo Normal</th>
                  <th className="table-num">Saldo Terakhir</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const isAccountReferenced =
                    journals.some((j) => j.entries.some((e) => e.accountId === acc.id || e.accountCode === acc.code)) ||
                    masterCodes.some((mc) => mc.debitAccountId === acc.id || mc.creditAccountId === acc.id);
                  return (
                    <tr key={acc.id} style={{ opacity: acc.isActive ? 1 : 0.65 }}>
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
                          {acc.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{acc.name}</td>
                      <td style={{ fontSize: '12.5px' }}>{acc.category}</td>
                      <td style={{ fontSize: '12.5px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: acc.normalBalance === 'Debit' ? '#1D4ED8' : '#B45309'
                          }}
                        >
                          {acc.normalBalance}
                        </span>
                      </td>
                      <td className="table-num" style={{ fontWeight: 700 }}>
                        Rp {acc.balance.toLocaleString('id-ID')}
                      </td>
                      <td>
                        <Badge variant={acc.isActive ? 'success' : 'neutral'}>
                          {acc.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditAccountModal(acc)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={acc.isActive ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleAccount(acc)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            {acc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                          {!isAccountReferenced && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteAccount(acc)}
                              style={{ padding: '3px 8px', fontSize: '12px' }}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: JURNAL UMUM (Dinamis dari context.journals) */}
      {activeTab === 'jurnal' && (
        <Card
          title="Jurnal Umum Kronologis"
          subtitle={`Total ${journals.length} Jurnal Transaksi Tercatat • Seluruh Dokumen Double-Entry Seimbang`}
        >
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>Tanggal</th>
                  <th style={{ width: '160px' }}>No. Bukti / Jurnal</th>
                  <th style={{ width: '70px' }}>Kode</th>
                  <th>Keterangan / Rincian Akun</th>
                  <th className="table-num" style={{ width: '130px' }}>Debit</th>
                  <th className="table-num" style={{ width: '130px' }}>Kredit</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {journals.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-muted-text)' }}>
                      Belum ada jurnal umum yang tercatat.
                    </td>
                  </tr>
                ) : (
                  journals.map((j) => {
                    const totalDebit = j.entries.reduce((sum, e) => sum + e.debit, 0);
                    const totalCredit = j.entries.reduce((sum, e) => sum + e.credit, 0);
                    const isBalanced = j.isBalanced ?? (totalDebit === totalCredit);

                    return (
                      <React.Fragment key={j.id}>
                        <tr style={{ backgroundColor: 'var(--color-surface-subtle)', borderTop: '2px solid var(--color-border)' }}>
                          <td style={{ fontWeight: 600, fontSize: '12.5px', whiteSpace: 'nowrap' }}>{j.date}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>{j.evidenceNo || j.id}</td>
                          <td>
                            {j.transCode ? (
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'var(--blue-50)', color: 'var(--color-primary-dark)', padding: '2px 5px', borderRadius: '3px' }}>
                                #{j.transCode}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{j.description}</td>
                          <td className="table-num" style={{ fontWeight: 700 }}>Rp {totalDebit.toLocaleString('id-ID')}</td>
                          <td className="table-num" style={{ fontWeight: 700 }}>Rp {totalCredit.toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge variant={isBalanced ? 'success' : 'danger'}>
                              {isBalanced ? 'Balance' : 'Selisih'}
                            </Badge>
                          </td>
                        </tr>
                        {j.entries.map((entry, eIdx) => {
                          const isCredit = entry.credit > 0;
                          return (
                            <tr key={`${j.id}-entry-${eIdx}`} style={{ fontSize: '12.5px' }}>
                              <td colSpan={3}></td>
                              <td style={{ paddingLeft: isCredit ? '34px' : '14px', color: isCredit ? '#475569' : '#0F172A' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: '6px' }}>[{entry.accountCode}]</span>
                                {entry.accountName}
                              </td>
                              <td className="table-num">
                                {entry.debit > 0 ? `Rp ${entry.debit.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="table-num">
                                {entry.credit > 0 ? `Rp ${entry.credit.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: BUKU BESAR (Dinamis dari akun COA dan mutasi Jurnal) */}
      {activeTab === 'buku_besar' && (() => {
        const relevantEntries: Array<{
          date: string;
          evidenceNo: string;
          description: string;
          debit: number;
          credit: number;
        }> = [];

        journals.forEach((j) => {
          j.entries.forEach((entry) => {
            if (entry.accountId === currentLedgerAcc.id || entry.accountCode === currentLedgerAcc.code) {
              relevantEntries.push({
                date: j.date,
                evidenceNo: j.evidenceNo || j.id,
                description: j.description,
                debit: entry.debit,
                credit: entry.credit
              });
            }
          });
        });

        // Hitung saldo awal berbasis selisih saldo saat ini dikurangi seluruh mutasi jurnal yang ada
        const totalNetMutation = relevantEntries.reduce((sum, item) => {
          return currentLedgerAcc.normalBalance === 'Debit'
            ? sum + (item.debit - item.credit)
            : sum + (item.credit - item.debit);
        }, 0);

        const initialBalance = currentLedgerAcc.balance - totalNetMutation;
        let runningBalance = initialBalance;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Pilih Akun Buku Besar:</span>
              <select
                className="form-select"
                style={{ maxWidth: '420px' }}
                value={selectedLedgerAccount}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLedgerAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name} ({a.category}) • Saldo: Rp {a.balance.toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            </div>

            <Card
              title={`Buku Besar: [${currentLedgerAcc.code}] ${currentLedgerAcc.name}`}
              subtitle={`Kategori: ${currentLedgerAcc.category} • Saldo Normal: ${currentLedgerAcc.normalBalance} • Saldo Saat Ini: Rp ${currentLedgerAcc.balance.toLocaleString('id-ID')}`}
            >
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Tanggal</th>
                      <th style={{ width: '160px' }}>No. Bukti / Jurnal</th>
                      <th>Keterangan</th>
                      <th className="table-num" style={{ width: '130px' }}>Debit</th>
                      <th className="table-num" style={{ width: '130px' }}>Kredit</th>
                      <th className="table-num" style={{ width: '140px' }}>Saldo Berjalan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2026-09-01</td>
                      <td style={{ color: 'var(--color-muted-text)' }}>-</td>
                      <td style={{ color: 'var(--color-muted-text)', fontStyle: 'italic' }}>Saldo Awal Periode</td>
                      <td className="table-num">-</td>
                      <td className="table-num">-</td>
                      <td className="table-num" style={{ fontWeight: 700 }}>
                        Rp {initialBalance.toLocaleString('id-ID')}
                      </td>
                    </tr>
                    {relevantEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-muted-text)' }}>
                          Belum ada mutasi transaksi untuk akun ini pada periode berjalan.
                        </td>
                      </tr>
                    ) : (
                      relevantEntries.map((row, idx) => {
                        if (currentLedgerAcc.normalBalance === 'Debit') {
                          runningBalance += row.debit - row.credit;
                        } else {
                          runningBalance += row.credit - row.debit;
                        }

                        return (
                          <tr key={idx}>
                            <td style={{ fontSize: '12.5px' }}>{row.date}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>{row.evidenceNo}</td>
                            <td style={{ fontWeight: 600 }}>{row.description}</td>
                            <td className="table-num">
                              {row.debit > 0 ? `Rp ${row.debit.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="table-num">
                              {row.credit > 0 ? `Rp ${row.credit.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="table-num" style={{ fontWeight: 700 }}>
                              Rp {runningBalance.toLocaleString('id-ID')}
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
        );
      })()}

      {/* TAB 5: BUKU PEMBANTU (PIUTANG & HUTANG) */}
      {activeTab === 'buku_bantu' && (() => {
        const totalReceivable = receivables.reduce((sum, r) => sum + r.outstanding, 0);
        const totalPayable = payables.reduce((sum, p) => sum + p.outstanding, 0);

        const filteredPartners = businessPartners.filter((p) => {
          const matchesType = partnerTypeFilter === 'Semua' ? true : p.type === partnerTypeFilter;
          const matchesSearch = partnerSearch.trim() === '' ? true : (
            p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
            p.code.toLowerCase().includes(partnerSearch.toLowerCase()) ||
            (p.phone && p.phone.includes(partnerSearch)) ||
            (p.address && p.address.toLowerCase().includes(partnerSearch.toLowerCase()))
          );
          return matchesType && matchesSearch;
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <Card>
                <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                  TOTAL PIUTANG USAHA (OUTSTANDING)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary-dark)', margin: '6px 0' }}>
                  Rp {totalReceivable.toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-dark-text)' }}>
                  {receivables.filter(r => r.status !== 'Paid').length} Tagihan Pelanggan Belum Lunas
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: '12.5px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                  TOTAL HUTANG USAHA (OUTSTANDING)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-danger)', margin: '6px 0' }}>
                  Rp {totalPayable.toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-dark-text)' }}>
                  {payables.filter(p => p.status !== 'Paid').length} Kewajiban Supplier Belum Dibayar
                </div>
              </Card>
            </div>

            {/* Bagian: Kelola Mitra Bisnis (Master Vendor & Pelanggan) */}
            <Card
              title="Kelola Mitra Bisnis (Master Vendor & Pelanggan)"
              subtitle="Pendaftaran dan pengelolaan rekanan pemasok (Vendor) dan pelanggan kredit SPBU."
              actions={
                <Button variant="primary" size="sm" onClick={() => openAddPartnerModal('Vendor')}>
                  + Tambah Mitra Bisnis
                </Button>
              }
            >
              {/* Petunjuk pendaftaran vendor */}
              <div
                style={{
                  padding: '9px 12px',
                  backgroundColor: 'var(--blue-50)',
                  border: '1px solid var(--blue-200)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '12px',
                  color: 'var(--color-primary-dark)',
                  marginBottom: '14px',
                  lineHeight: 1.45
                }}
              >
                ℹ️ <strong>Petunjuk Rekanan:</strong> Pemasok BBM, pelumas, dan operasional SPBU didaftarkan dengan tipe <strong>Vendor</strong> agar langsung muncul pada form Transaksi Pembayaran Hutang dan Pembelian. Pelanggan kredit/kupon instansi didaftarkan dengan tipe <strong>Customer</strong>.
              </div>

              {/* Filter Tabs & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['Semua', 'Vendor', 'Customer'] as const).map((t) => (
                    <Button
                      key={t}
                      variant={partnerTypeFilter === t ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setPartnerTypeFilter(t)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      {t === 'Semua' ? 'Semua Rekanan' : t === 'Vendor' ? 'Vendor / Pemasok' : 'Pelanggan / Kupon'}
                    </Button>
                  ))}
                </div>

                <div style={{ width: '260px' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '12.5px', padding: '5px 10px' }}
                    placeholder="Cari kode, nama, telepon..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Tabel Mitra Bisnis */}
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Kode</th>
                      <th>Nama Rekanan / Perusahaan</th>
                      <th style={{ width: '130px' }}>Tipe</th>
                      <th>No. Telepon</th>
                      <th>Alamat</th>
                      <th style={{ width: '95px' }}>Status</th>
                      <th style={{ width: '185px' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted-text)' }}>
                          Tidak ada data mitra bisnis yang sesuai.
                        </td>
                      </tr>
                    ) : (
                      filteredPartners.map((p) => {
                        const isPartnerReferenced =
                          transactions.some((t) => (t as any).partnerId === p.id) ||
                          receivables.some((r) => r.partnerId === p.id) ||
                          payables.some((py) => py.partnerId === p.id);
                        return (
                          <tr key={p.id} style={{ opacity: p.isActive === false ? 0.65 : 1 }}>
                            <td>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  backgroundColor: p.type === 'Vendor' ? 'var(--blue-50)' : '#ECFDF5',
                                  color: p.type === 'Vendor' ? 'var(--color-primary-dark)' : '#065F46',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  border: `1px solid ${p.type === 'Vendor' ? 'var(--blue-200)' : '#A7F3D0'}`,
                                  fontSize: '12px'
                                }}
                              >
                                {p.code}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>
                              <Badge variant={p.type === 'Vendor' ? 'primary' : 'success'}>
                                {p.type === 'Vendor' ? 'Vendor / Pemasok' : 'Pelanggan'}
                              </Badge>
                            </td>
                            <td style={{ fontSize: '12.5px' }}>{p.phone || '-'}</td>
                            <td style={{ fontSize: '12.5px', color: 'var(--color-muted-text)' }}>{p.address || '-'}</td>
                            <td>
                              <Badge variant={p.isActive !== false ? 'success' : 'neutral'}>
                                {p.isActive !== false ? 'Aktif' : 'Nonaktif'}
                              </Badge>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditPartnerModal(p)}
                                  style={{ padding: '3px 8px', fontSize: '12px' }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant={p.isActive !== false ? 'secondary' : 'primary'}
                                  size="sm"
                                  onClick={() => handleTogglePartner(p)}
                                  style={{ padding: '3px 8px', fontSize: '12px' }}
                                >
                                  {p.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                                </Button>
                                {!isPartnerReferenced && (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDeletePartner(p)}
                                    style={{ padding: '3px 8px', fontSize: '12px' }}
                                  >
                                    Hapus
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Sub-Card 1: Piutang */}
            <Card
              title="Buku Pembantu Piutang Usaha (Pelanggan / Kupon)"
              subtitle="Pencatatan tagihan penjualan kredit dan histori pelunasan invoice"
            >
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID Tagihan</th>
                      <th>Customer / Pihak Ketiga</th>
                      <th>Tanggal</th>
                      <th>Keterangan</th>
                      <th className="table-num">Total Tagihan</th>
                      <th className="table-num">Sisa Piutang (Outstanding)</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted-text)' }}>
                          Tidak ada data piutang usaha.
                        </td>
                      </tr>
                    ) : (
                      receivables.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.id}</td>
                          <td style={{ fontWeight: 600 }}>{r.partnerName}</td>
                          <td style={{ fontSize: '12.5px' }}>{r.date}</td>
                          <td style={{ fontSize: '12.5px', color: 'var(--color-muted-text)' }}>{r.notes || '-'}</td>
                          <td className="table-num">Rp {r.amount.toLocaleString('id-ID')}</td>
                          <td className="table-num" style={{ fontWeight: 700, color: r.outstanding > 0 ? 'var(--color-primary-dark)' : 'var(--color-success)' }}>
                            Rp {r.outstanding.toLocaleString('id-ID')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge variant={r.status === 'Paid' ? 'success' : r.status === 'Partial' ? 'primary' : 'warning'}>
                              {r.status === 'Paid' ? 'Lunas' : r.status === 'Partial' ? 'Sebagian' : 'Belum Lunas'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Sub-Card 2: Hutang */}
            <Card
              title="Buku Pembantu Hutang Usaha (Vendor / Supplier)"
              subtitle="Pencatatan kewajiban pembelian kredit dan status pembayaran"
            >
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID Hutang</th>
                      <th>Vendor / Supplier</th>
                      <th>Tanggal</th>
                      <th>Keterangan</th>
                      <th className="table-num">Total Hutang</th>
                      <th className="table-num">Sisa Hutang (Outstanding)</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted-text)' }}>
                          Tidak ada data hutang usaha.
                        </td>
                      </tr>
                    ) : (
                      payables.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.id}</td>
                          <td style={{ fontWeight: 600 }}>{p.partnerName}</td>
                          <td style={{ fontSize: '12.5px' }}>{p.date}</td>
                          <td style={{ fontSize: '12.5px', color: 'var(--color-muted-text)' }}>{p.notes || '-'}</td>
                          <td className="table-num">Rp {p.amount.toLocaleString('id-ID')}</td>
                          <td className="table-num" style={{ fontWeight: 700, color: p.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            Rp {p.outstanding.toLocaleString('id-ID')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge variant={p.status === 'Paid' ? 'success' : p.status === 'Partial' ? 'primary' : 'warning'}>
                              {p.status === 'Paid' ? 'Lunas' : p.status === 'Partial' ? 'Sebagian' : 'Belum Lunas'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* MODAL TAMBAH / EDIT BAGAN AKUN (COA) */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title={editingAccount ? 'Edit Akun COA' : 'Tambah Akun COA Baru'}
      >
        <form onSubmit={handleSaveAccount}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Kode Akun <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={accCode}
                onChange={(e) => setAccCode(e.target.value)}
                placeholder="Contoh: 1-1003"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Nama Akun <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="Contoh: Bank BRI Operasional"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select
                className="form-select"
                value={accCategory}
                onChange={(e) => setAccCategory(e.target.value as Account['category'])}
              >
                <option value="Aset">Aset</option>
                <option value="Kewajiban">Kewajiban</option>
                <option value="Ekuitas">Ekuitas</option>
                <option value="Pendapatan">Pendapatan</option>
                <option value="Beban Pokok">Beban Pokok</option>
                <option value="Beban">Beban</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Saldo Normal</label>
              <select
                className="form-select"
                value={accNormalBalance}
                onChange={(e) => setAccNormalBalance(e.target.value as 'Debit' | 'Kredit')}
              >
                <option value="Debit">Debit</option>
                <option value="Kredit">Kredit</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Saldo Awal (Rp)</label>
              <input
                type="number"
                className="form-control"
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status Akun</label>
              <select
                className="form-select"
                value={accIsActive ? 'aktif' : 'nonaktif'}
                onChange={(e) => setAccIsActive(e.target.value === 'aktif')}
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsAccountModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingAccount ? 'Simpan Perubahan' : 'Tambah Akun'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TAMBAH / EDIT MASTER KODE (COA SELECTOR REFERENCE) */}
      <Modal
        isOpen={isMasterCodeModalOpen}
        onClose={() => setIsMasterCodeModalOpen(false)}
        title={editingMasterCode ? 'Edit Master Kode' : 'Tambah Master Kode Baru'}
      >
        <form onSubmit={handleSaveMasterCode}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Kode Transaksi <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={mcCode}
                onChange={(e) => setMcCode(e.target.value)}
                placeholder="Contoh: 310"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Nama Transaksi <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={mcName}
                onChange={(e) => setMcName(e.target.value)}
                placeholder="Contoh: Penjualan Dexlite Tunai"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select
                className="form-select"
                value={mcCategory}
                onChange={(e) => setMcCategory(e.target.value as MasterCode['category'])}
              >
                <option value="Penjualan">Penjualan</option>
                <option value="Pembelian">Pembelian</option>
                <option value="Biaya Operasional">Biaya Operasional</option>
                <option value="Persediaan">Persediaan</option>
                <option value="Pelunasan">Pelunasan</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Metode Pembayaran <span className="required">*</span></label>
              <select
                className="form-select"
                value={mcPaymentMethod}
                onChange={(e) => setMcPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="Tunai">Tunai</option>
                <option value="Piutang">Piutang (Kredit)</option>
                <option value="Hutang">Hutang (Kredit)</option>
                <option value="Transfer">Transfer Bank</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Produk Terkait (Opsional)</label>
              <select
                className="form-select"
                value={mcProductId}
                onChange={(e) => setMcProductId(e.target.value)}
              >
                <option value="">-- Tanpa Produk --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Akun Debit & Kredit mengambil selector reference ke COA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Akun Debit (COA) <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={mcDebitAccId}
                onChange={(e) => setMcDebitAccId(e.target.value)}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Akun Kredit (COA) <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={mcCreditAccId}
                onChange={(e) => setMcCreditAccId(e.target.value)}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan Standar</label>
            <input
              type="text"
              className="form-control"
              value={mcDesc}
              onChange={(e) => setMcDesc(e.target.value)}
              placeholder="Deskripsi otomatis entri transaksi"
            />
          </div>

          <div style={{ display: 'flex', gap: '20px', margin: '14px 0 6px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={mcRequiresTera}
                onChange={(e) => setMcRequiresTera(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Membutuhkan Pengukuran Tera Nozzle</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={mcIsActive}
                onChange={(e) => setMcIsActive(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Status Aktif</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsMasterCodeModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingMasterCode ? 'Simpan Perubahan' : 'Simpan Master Kode'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TAMBAH / EDIT MITRA BISNIS (VENDOR & PELANGGAN) */}
      <Modal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        title={editingPartner ? `Edit Mitra Bisnis: ${editingPartner.name}` : 'Tambah Mitra Bisnis Baru'}
      >
        <form onSubmit={handleSavePartner}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Tipe Rekanan <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={bpType}
                onChange={(e) => setBpType(e.target.value as 'Customer' | 'Vendor')}
              >
                <option value="Vendor">Vendor / Pemasok (Supplier)</option>
                <option value="Customer">Customer / Pelanggan Kredit</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Kode Rekanan <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={bpCode}
                onChange={(e) => setBpCode(e.target.value)}
                placeholder={bpType === 'Vendor' ? 'Contoh: VEN-001' : 'Contoh: CUS-001'}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Nama Rekanan / Perusahaan <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={bpName}
              onChange={(e) => setBpName(e.target.value)}
              placeholder={bpType === 'Vendor' ? 'Contoh: PT Pertamina Patra Niaga' : 'Contoh: PT Sawit Makmur Lestari'}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nomor Telepon / Kontak</label>
            <input
              type="text"
              className="form-control"
              value={bpPhone}
              onChange={(e) => setBpPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Alamat Lengkap</label>
            <textarea
              className="form-control"
              rows={2}
              value={bpAddress}
              onChange={(e) => setBpAddress(e.target.value)}
              placeholder="Alamat kantor / gudang rekanan..."
            />
          </div>

          <div style={{ margin: '14px 0 6px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={bpIsActive}
                onChange={(e) => setBpIsActive(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Status Aktif (dapat dipilih pada transaksi)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsPartnerModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingPartner ? 'Simpan Perubahan' : 'Simpan Mitra Bisnis'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
