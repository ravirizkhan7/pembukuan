import React, { useState } from 'react';
import { PageHeader } from '../components/common';
import { Card, Button, Modal, Badge } from '../components/ui';
import {
  Product,
  Tank,
  Nozzle,
  ProductCategory,
  Tera,
  ToastType
} from '../types';
import { useAppContext } from '../context/AppContext';

export interface OperasionalPageProps {
  mockData?: any;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  showToast: (message: string, type?: ToastType) => void;
}

export function OperasionalPage({
  activeSubTab = 'tera',
  showToast
}: OperasionalPageProps) {
  const {
    products,
    addProduct,
    updateProduct,
    toggleProductStatus,
    productCategories,
    addProductCategory,
    updateProductCategory,
    toggleProductCategoryStatus,
    tanks,
    addTank,
    updateTank,
    toggleTankStatus,
    nozzles,
    addNozzle,
    updateNozzle,
    toggleNozzleStatus,
    shifts,
    activeShift,
    bukaShift,
    tutupShift,
    teraList,
    addTera,
    transactions
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<string>(activeSubTab || 'tera');

  React.useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  // ==========================================
  // STATE: Tera Modal & Form
  // ==========================================
  const [isTeraModalOpen, setIsTeraModalOpen] = useState<boolean>(false);
  const [selectedNozzleId, setSelectedNozzleId] = useState<string>(nozzles[0]?.id || 'NZL-01');
  const [teraAwal, setTeraAwal] = useState<string>(nozzles[0]?.currentMeter?.toString() || '0');
  const [teraAkhir, setTeraAkhir] = useState<string>('');
  const [inputSelisih, setInputSelisih] = useState<string>('0');

  const currentNozzle = nozzles.find((n) => n.id === selectedNozzleId) || nozzles[0];
  const matchedProduct = products.find((p) => p.id === currentNozzle?.productId || (currentNozzle?.productName && p.name.includes(currentNozzle.productName))) || products[0];

  const numTeraAwal = parseFloat(teraAwal) || 0;
  const numTeraAkhir = parseFloat(teraAkhir) || 0;
  const computedVolume = Math.max(0, parseFloat((numTeraAkhir - numTeraAwal).toFixed(2)));
  const computedSalesValue = computedVolume * (matchedProduct ? matchedProduct.sellPrice : 0);

  const handleSaveTera = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentNozzle) return;

    if (!teraAkhir || numTeraAkhir <= numTeraAwal) {
      showToast('Tera Akhir wajib diisi dan harus lebih besar dari Tera Awal.', 'danger');
      return;
    }

    const newTera: Tera = {
      id: `TRA-${Date.now().toString().slice(-4)}`,
      date: '2026-09-24',
      shiftId: activeShift ? activeShift.id : 'SFT-01',
      shift: activeShift ? activeShift.name : 'Shift 1',
      nozzleId: currentNozzle.id,
      nozzleCode: currentNozzle.code,
      productId: currentNozzle.productId || matchedProduct?.id,
      productName: currentNozzle.productName || matchedProduct?.name || 'BBM',
      price: matchedProduct ? matchedProduct.sellPrice : 10000,
      teraAwal: numTeraAwal,
      teraAkhir: numTeraAkhir,
      volume: computedVolume,
      selisih: parseFloat(inputSelisih) || 0,
      salesAmount: computedSalesValue,
      officer: activeShift?.operator || 'Petugas SPBU',
      status: 'Valid'
    };

    addTera(newTera);
    setIsTeraModalOpen(false);
    showToast(`Data Tera Nozzle [${currentNozzle.code}] berhasil dicatat.`, 'success');
  };

  // ==========================================
  // STATE: Shift Dinamis (Buka & Tutup)
  // ==========================================
  const [isBukaShiftModalOpen, setIsBukaShiftModalOpen] = useState<boolean>(false);
  const [isTutupShiftModalOpen, setIsTutupShiftModalOpen] = useState<boolean>(false);

  // Form Buka Shift
  const [selectedShiftToOpen, setSelectedShiftToOpen] = useState<string>(
    shifts.find(s => s.status === 'Menunggu')?.id || shifts[0]?.id || 'SFT-01'
  );
  const [bukaDate, setBukaDate] = useState<string>('2026-09-24');
  const [bukaStartTime, setBukaStartTime] = useState<string>('07:00');
  const [bukaOperator, setBukaOperator] = useState<string>('Ahmad Fauzi');
  const [bukaInitialCash, setBukaInitialCash] = useState<string>('1000000');

  // Form Tutup Shift
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<string>(
    activeShift?.id || shifts.find(s => s.status === 'Aktif')?.id || 'SFT-01'
  );
  const [tutupCashHandover, setTutupCashHandover] = useState<string>('');

  const targetShiftToClose = shifts.find(s => s.id === selectedShiftToClose) || activeShift || shifts[0];
  const shiftTxList = transactions.filter(t => t.shiftId === targetShiftToClose?.id);
  const calculatedShiftSales = shiftTxList.reduce((acc, t) => acc + (t.total || 0), 0) || targetShiftToClose?.totalSales || 0;
  const initialCashVal = targetShiftToClose?.initialCash || 0;
  const enteredCash = parseFloat(tutupCashHandover) || 0;
  const computedDiscrepancy = enteredCash - (initialCashVal + calculatedShiftSales);

  const openBukaShiftDialog = (shiftId?: string) => {
    const target = shiftId ? shifts.find(s => s.id === shiftId) : shifts.find(s => s.status === 'Menunggu') || shifts[0];
    if (target) {
      setSelectedShiftToOpen(target.id);
      setBukaStartTime(target.startTime || '07:00');
      setBukaOperator(target.operator || 'Operator SPBU');
      setBukaInitialCash(target.initialCash?.toString() || '1000000');
    }
    setIsBukaShiftModalOpen(true);
  };

  const openTutupShiftDialog = (shiftId?: string) => {
    const target = shiftId ? shifts.find(s => s.id === shiftId) : activeShift || shifts.find(s => s.status === 'Aktif') || shifts[0];
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
    const s = shifts.find(item => item.id === selectedShiftToOpen);
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
    const s = shifts.find(item => item.id === selectedShiftToClose);
    showToast(`${s?.name || selectedShiftToClose} telah ditutup.`, 'success');
    setIsTutupShiftModalOpen(false);
  };

  // ==========================================
  // STATE: Produk BBM & Oli CRUD
  // ==========================================
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCode, setProdCode] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodCategoryId, setProdCategoryId] = useState<string>(productCategories[0]?.id || 'PCAT-001');
  const [prodUnit, setProdUnit] = useState<string>('Liter');
  const [prodBuyPrice, setProdBuyPrice] = useState<string>('');
  const [prodSellPrice, setProdSellPrice] = useState<string>('');
  const [prodTankId, setProdTankId] = useState<string>('');
  const [prodStatus, setProdStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdCode('');
    setProdName('');
    setProdCategoryId(productCategories.find((c) => c.status === 'Aktif')?.id || 'PCAT-001');
    setProdUnit('Liter');
    setProdBuyPrice('');
    setProdSellPrice('');
    setProdTankId(tanks[0]?.id || '');
    setProdStatus('Aktif');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setProdCode(prod.code);
    setProdName(prod.name);
    setProdCategoryId(prod.categoryId || productCategories[0]?.id || 'PCAT-001');
    setProdUnit(prod.unit);
    setProdBuyPrice(prod.buyPrice.toString());
    setProdSellPrice(prod.sellPrice.toString());
    setProdTankId(prod.tankId || '');
    setProdStatus(prod.status || 'Aktif');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prodCode.trim() || !prodName.trim()) {
      showToast('Kode dan Nama Produk wajib diisi.', 'danger');
      return;
    }

    const buyNum = parseFloat(prodBuyPrice) || 0;
    const sellNum = parseFloat(prodSellPrice) || 0;

    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        code: prodCode.trim(),
        name: prodName.trim(),
        categoryId: prodCategoryId,
        unit: prodUnit,
        buyPrice: buyNum,
        sellPrice: sellNum,
        tankId: prodTankId || undefined,
        status: prodStatus
      });
      showToast(`Produk [${prodCode}] berhasil diperbarui.`, 'success');
    } else {
      addProduct({
        id: `PRD-${Date.now().toString().slice(-4)}`,
        code: prodCode.trim(),
        name: prodName.trim(),
        categoryId: prodCategoryId,
        unit: prodUnit,
        buyPrice: buyNum,
        sellPrice: sellNum,
        tankId: prodTankId || undefined,
        status: prodStatus
      });
      showToast(`Produk [${prodCode}] ${prodName} berhasil ditambahkan.`, 'success');
    }

    setIsProductModalOpen(false);
  };

  const handleToggleProduct = (prod: Product) => {
    toggleProductStatus(prod.id);
    const next = prod.status === 'Aktif' ? 'dinonaktifkan' : 'diaktifkan';
    showToast(`Produk [${prod.code}] ${next}.`, 'primary');
  };

  // ==========================================
  // STATE: Kategori Produk CRUD
  // ==========================================
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catStatus, setCatStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatStatus('Aktif');
  };

  const openEditCategory = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatStatus(cat.status);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('Nama kategori wajib diisi.', 'danger');
      return;
    }
    if (editingCategory) {
      updateProductCategory({
        ...editingCategory,
        name: catName.trim(),
        status: catStatus
      });
      showToast(`Kategori [${catName}] berhasil diperbarui.`, 'success');
      setEditingCategory(null);
      setCatName('');
    } else {
      addProductCategory({
        name: catName.trim(),
        status: catStatus
      });
      showToast(`Kategori [${catName}] berhasil ditambahkan.`, 'success');
      setCatName('');
    }
  };

  // ==========================================
  // STATE: Tanki Pendam CRUD
  // ==========================================
  const [isTankModalOpen, setIsTankModalOpen] = useState<boolean>(false);
  const [editingTank, setEditingTank] = useState<Tank | null>(null);
  const [tankId, setTankId] = useState<string>('');
  const [tankName, setTankName] = useState<string>('');
  const [tankProductId, setTankProductId] = useState<string>('');
  const [tankCapacity, setTankCapacity] = useState<string>('');
  const [tankStatus, setTankStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddTankModal = () => {
    setEditingTank(null);
    setTankId(`TNK-${(tanks.length + 1).toString().padStart(2, '0')}`);
    setTankName(`Tanki Pendam ${tanks.length + 1}`);
    setTankProductId(products[0]?.id || '');
    setTankCapacity('20000');
    setTankStatus('Aktif');
    setIsTankModalOpen(true);
  };

  const openEditTankModal = (t: Tank) => {
    setEditingTank(t);
    setTankId(t.id);
    setTankName(t.name);
    setTankProductId(t.productId);
    setTankCapacity(t.capacity.toString());
    setTankStatus(t.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif');
    setIsTankModalOpen(true);
  };

  const handleSaveTank = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = tankId.trim();
    const cleanName = tankName.trim();
    const capNum = parseFloat(tankCapacity) || 0;

    if (!cleanId || !cleanName) {
      showToast('ID dan Nama Tanki wajib diisi.', 'danger');
      return;
    }
    if (!tankProductId) {
      showToast('Produk BBM untuk tanki wajib dipilih.', 'danger');
      return;
    }
    if (capNum <= 0) {
      showToast('Kapasitas tanki harus lebih dari 0 Liter.', 'danger');
      return;
    }

    if (!editingTank && tanks.some(t => t.id.toLowerCase() === cleanId.toLowerCase())) {
      showToast(`ID Tanki "${cleanId}" sudah digunakan. Gunakan ID lain.`, 'danger');
      return;
    }

    const linkedProd = products.find(p => p.id === tankProductId);

    if (editingTank) {
      updateTank({
        ...editingTank,
        name: cleanName,
        productId: tankProductId,
        productName: linkedProd?.name || editingTank.productName,
        capacity: capNum,
        status: tankStatus
      });
      showToast(`Tanki [${cleanId}] berhasil diperbarui.`, 'success');
    } else {
      addTank({
        id: cleanId,
        name: cleanName,
        productId: tankProductId,
        productName: linkedProd?.name || 'BBM',
        capacity: capNum,
        currentStock: 0,
        unit: 'Liter',
        lastSounding: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: tankStatus
      });
      showToast(`Tanki [${cleanId}] berhasil ditambahkan.`, 'success');
    }
    setIsTankModalOpen(false);
  };

  const handleToggleTank = (t: Tank) => {
    toggleTankStatus(t.id);
    const next = t.status === 'Aktif' || t.status === 'Aman' ? 'dinonaktifkan' : 'diaktifkan';
    showToast(`Tanki [${t.name}] ${next}.`, 'primary');
  };

  // ==========================================
  // STATE: Nozzle Dispenser CRUD
  // ==========================================
  const [isNozzleModalOpen, setIsNozzleModalOpen] = useState<boolean>(false);
  const [editingNozzle, setEditingNozzle] = useState<Nozzle | null>(null);
  const [nozzleId, setNozzleId] = useState<string>('');
  const [nozzleCode, setNozzleCode] = useState<string>('');
  const [nozzleIsland, setNozzleIsland] = useState<string>('');
  const [nozzleTankId, setNozzleTankId] = useState<string>('');
  const [nozzleProductId, setNozzleProductId] = useState<string>('');
  const [nozzleCurrentMeter, setNozzleCurrentMeter] = useState<string>('');
  const [nozzleStatus, setNozzleStatus] = useState<'Aktif' | 'Maintenance' | 'Nonaktif'>('Aktif');

  const openAddNozzleModal = () => {
    setEditingNozzle(null);
    const defaultTank = tanks[0];
    setNozzleId(`NZL-${(nozzles.length + 1).toString().padStart(2, '0')}`);
    setNozzleCode(`NZ-${(nozzles.length + 1).toString().padStart(2, '0')}`);
    setNozzleIsland('Pulau 1 (Mobil)');
    setNozzleTankId(defaultTank?.id || '');
    setNozzleProductId(defaultTank?.productId || products[0]?.id || '');
    setNozzleCurrentMeter('0.0');
    setNozzleStatus('Aktif');
    setIsNozzleModalOpen(true);
  };

  const openEditNozzleModal = (nz: Nozzle) => {
    setEditingNozzle(nz);
    setNozzleId(nz.id);
    setNozzleCode(nz.code);
    setNozzleIsland(nz.island);
    setNozzleTankId(nz.tankId);
    setNozzleProductId(nz.productId);
    setNozzleCurrentMeter(nz.currentMeter.toString());
    setNozzleStatus(nz.status);
    setIsNozzleModalOpen(true);
  };

  const handleSaveNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = nozzleId.trim();
    const cleanCode = nozzleCode.trim();
    const meterNum = parseFloat(nozzleCurrentMeter) || 0;

    if (!cleanId || !cleanCode) {
      showToast('ID dan Kode Nozzle wajib diisi.', 'danger');
      return;
    }
    if (!nozzleTankId) {
      showToast('Tanki sumber wajib dipilih.', 'danger');
      return;
    }
    if (!nozzleProductId) {
      showToast('Produk BBM wajib dipilih.', 'danger');
      return;
    }

    // Consistency rule: Section H
    const selTank = tanks.find(t => t.id === nozzleTankId);
    if (selTank && selTank.productId !== nozzleProductId) {
      const tankProd = products.find(p => p.id === selTank.productId);
      const chosenProd = products.find(p => p.id === nozzleProductId);
      showToast(
        `Relasi tidak konsisten: Tanki [${selTank.name}] menampung ${tankProd?.name || 'produk lain'}, bukan ${chosenProd?.name || nozzleProductId}.`,
        'danger'
      );
      return;
    }

    if (!editingNozzle && nozzles.some(n => n.id.toLowerCase() === cleanId.toLowerCase())) {
      showToast(`ID Nozzle "${cleanId}" sudah digunakan. Gunakan ID lain.`, 'danger');
      return;
    }

    const linkedProd = products.find(p => p.id === nozzleProductId);

    if (editingNozzle) {
      updateNozzle({
        ...editingNozzle,
        code: cleanCode,
        island: nozzleIsland.trim() || 'Pulau 1',
        tankId: nozzleTankId,
        productId: nozzleProductId,
        productName: linkedProd?.name || editingNozzle.productName,
        currentMeter: meterNum,
        status: nozzleStatus
      });
      showToast(`Nozzle [${cleanCode}] berhasil diperbarui.`, 'success');
    } else {
      addNozzle({
        id: cleanId,
        code: cleanCode,
        island: nozzleIsland.trim() || 'Pulau 1',
        tankId: nozzleTankId,
        productId: nozzleProductId,
        productName: linkedProd?.name || 'BBM',
        currentMeter: meterNum,
        status: nozzleStatus
      });
      showToast(`Nozzle [${cleanCode}] berhasil ditambahkan.`, 'success');
    }
    setIsNozzleModalOpen(false);
  };

  const handleToggleNozzle = (nz: Nozzle) => {
    toggleNozzleStatus(nz.id);
    const next = nz.status === 'Aktif' ? 'dialihkan ke Maintenance' : 'diaktifkan kembali';
    showToast(`Nozzle [${nz.code}] ${next}.`, 'primary');
  };

  // Header switcher
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'tera':
        return {
          title: 'Monitoring Tera Nozzle',
          subtitle: 'Pencatatan volume meteran tera per nozzle dispenser berelasi ke transaksi',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsTeraModalOpen(true)}
            >
              + Input Data Tera
            </Button>
          )
        };
      case 'tanki':
        return {
          title: 'Tanki Pendam',
          subtitle: 'Kapasitas penyimpanan, stok sounding fisik, dan persentase level BBM',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddTankModal}
            >
              + Tambah Tanki
            </Button>
          )
        };
      case 'nozzle':
        return {
          title: 'Nozzle Dispenser',
          subtitle: 'Daftar nozzle aktif, pulau pompa, dan totalizer meter dispenser',
          actions: (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddNozzleModal}
            >
              + Tambah Nozzle
            </Button>
          )
        };
      case 'shift':
        return {
          title: 'Shift Kerja Dinamis',
          subtitle: 'Pengelolaan sesi kerja operasional, serah terima modal awal, dan setoran kas',
          actions: (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openBukaShiftDialog()}
              >
                Buka Shift
              </Button>
              {activeShift && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openTutupShiftDialog()}
                >
                  Tutup Shift Aktif
                </Button>
              )}
            </div>
          )
        };
      case 'produk':
        return {
          title: 'Produk BBM & Oli',
          subtitle: 'Master data produk BBM & Pelumas, penetapan harga jual/beli, dan relasi tanki',
          actions: (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  openAddCategory();
                  setIsCategoryModalOpen(true);
                }}
              >
                Kategori Produk
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openAddProductModal}
              >
                + Tambah Produk
              </Button>
            </div>
          )
        };
      default:
        return {
          title: 'Monitoring',
          subtitle: 'Data operasional SPBU',
          actions: null
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div>
      <PageHeader
        category="Monitoring"
        title={headerInfo.title}
        subtitle={headerInfo.subtitle}
        actions={headerInfo.actions}
      />

      {/* TAB 1: MONITORING TERA (Berelasi nozzleId & shiftId) */}
      {activeTab === 'tera' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Tera</th>
                  <th>Tanggal</th>
                  <th>Shift</th>
                  <th>Nozzle ID</th>
                  <th>Produk</th>
                  <th className="table-num">Tera Awal</th>
                  <th className="table-num">Tera Akhir</th>
                  <th className="table-num">Volume (L)</th>
                  <th className="table-num">Selisih</th>
                  <th className="table-num">Penjualan</th>
                  <th>Petugas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teraList.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted-text)' }}>
                      Belum ada data tera.
                    </td>
                  </tr>
                ) : (
                  teraList.map((tr) => (
                    <tr key={tr.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tr.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{tr.date}</td>
                      <td>{tr.shift}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'var(--blue-50)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--blue-200)', color: 'var(--color-primary-dark)' }}>
                          {tr.nozzleCode}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tr.productName}</td>
                      <td className="table-num">{tr.teraAwal.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                      <td className="table-num">{tr.teraAkhir.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                      <td className="table-num" style={{ fontWeight: 600 }}>
                        {tr.volume.toLocaleString('id-ID', { minimumFractionDigits: 1 })} L
                      </td>
                      <td className="table-num" style={{ color: 'var(--color-muted-text)' }}>{tr.selisih}</td>
                      <td className="table-num" style={{ fontWeight: 600 }}>
                        Rp {tr.salesAmount.toLocaleString('id-ID')}
                      </td>
                      <td>{tr.officer}</td>
                      <td>
                        <Badge variant="primary">{tr.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: TANKI PENDAM */}
      {activeTab === 'tanki' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Tanki</th>
                  <th>Nama Tanki</th>
                  <th>Produk BBM</th>
                  <th>Product ID</th>
                  <th className="table-num">Kapasitas</th>
                  <th className="table-num">Stok Fisik</th>
                  <th className="table-num">Level</th>
                  <th>Waktu Sounding</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((t) => {
                  const pct = Math.round((t.currentStock / t.capacity) * 100);
                  const isLow = pct < 35;
                  const prod = products.find((p) => p.id === t.productId);
                  return (
                    <tr key={t.id} style={{ opacity: t.status === 'Nonaktif' ? 0.65 : 1 }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.id}</td>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td>{prod ? prod.name : t.productName}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-muted-text)' }}>
                          {t.productId}
                        </span>
                      </td>
                      <td className="table-num">{t.capacity.toLocaleString('id-ID')} L</td>
                      <td className="table-num" style={{ fontWeight: 600 }}>
                        {t.currentStock.toLocaleString('id-ID')} L
                      </td>
                      <td className="table-num" style={{ color: isLow ? 'var(--color-red-accent)' : 'inherit', fontWeight: isLow ? 600 : 500 }}>
                        {pct}%
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--color-muted-text)' }}>{t.lastSounding}</td>
                      <td>
                        <Badge variant={t.status === 'Nonaktif' ? 'neutral' : isLow ? 'danger' : 'success'}>
                          {t.status}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditTankModal(t)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={t.status === 'Aktif' || t.status === 'Aman' ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleTank(t)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            {t.status === 'Aktif' || t.status === 'Aman' ? 'Nonaktifkan' : 'Aktifkan'}
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
      )}

      {/* TAB 3: NOZZLE DISPENSER */}
      {activeTab === 'nozzle' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nozzle ID</th>
                  <th>Kode Nozzle</th>
                  <th>Pulau Pompa</th>
                  <th>Produk BBM</th>
                  <th>Tanki Sumber (ID)</th>
                  <th className="table-num">Meteran Terakhir</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {nozzles.map((nz) => (
                  <tr key={nz.id} style={{ opacity: nz.status === 'Nonaktif' ? 0.65 : 1 }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-muted-text)' }}>{nz.id}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{nz.code}</td>
                    <td>{nz.island}</td>
                    <td style={{ fontWeight: 600 }}>{nz.productName}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                        {nz.tankId}
                      </span>
                    </td>
                    <td className="table-num" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {nz.currentMeter.toLocaleString('id-ID', { minimumFractionDigits: 1 })}
                    </td>
                    <td>
                      <Badge variant={nz.status === 'Aktif' ? 'success' : nz.status === 'Maintenance' ? 'warning' : 'neutral'}>
                        {nz.status}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditNozzleModal(nz)}
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={nz.status === 'Aktif' ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleNozzle(nz)}
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                        >
                          {nz.status === 'Aktif' ? 'Maintenance' : 'Aktifkan'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: SHIFT KERJA (DINAMIS DENGAN STATUS MENUNGGU -> AKTIF -> TUTUP) */}
      {activeTab === 'shift' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Shift ID</th>
                  <th>Nama Shift</th>
                  <th>Jam Kerja</th>
                  <th>Operator</th>
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
                    <td style={{ fontFamily: 'monospace' }}>{s.id}</td>
                    <td style={{ fontWeight: 700, color: s.status === 'Aktif' ? 'var(--color-primary)' : 'inherit' }}>
                      {s.name}
                    </td>
                    <td>{s.startTime} - {s.endTime} WIB</td>
                    <td style={{ fontWeight: 600 }}>{s.operator}</td>
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
                      ) : s.status === 'Menunggu' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openBukaShiftDialog(s.id)}
                          style={{ padding: '3px 10px', fontSize: '12px' }}
                        >
                          Buka Shift
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBukaShiftDialog(s.id)}
                          style={{ padding: '3px 8px', fontSize: '12px', color: 'var(--color-muted-text)' }}
                          title="Buka kembali sesi shift baru"
                        >
                          Buka Baru
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: PRODUK BBM & OLI - CRUD PENUH */}
      {activeTab === 'produk' && (
        <Card>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Kode</th>
                  <th>Nama Produk</th>
                  <th>Kategori</th>
                  <th>Satuan</th>
                  <th className="table-num">Harga Beli</th>
                  <th className="table-num">Harga Jual</th>
                  <th className="table-num">Margin</th>
                  <th>Relasi Tanki</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = p.sellPrice - p.buyPrice;
                  const tank = tanks.find((t) => t.id === p.tankId || t.productId === p.id);
                  const cat = productCategories.find((c) => c.id === p.categoryId);
                  return (
                    <tr key={p.id} style={{ opacity: p.status === 'Aktif' ? 1 : 0.65 }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-muted-text)' }}>
                        {p.id}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        <span style={{ backgroundColor: 'var(--blue-50)', padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--blue-200)', color: 'var(--color-primary-dark)' }}>
                          {p.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {cat?.name || p.categoryId}
                        </span>
                      </td>
                      <td>{p.unit}</td>
                      <td className="table-num">Rp {p.buyPrice.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ fontWeight: 600 }}>Rp {p.sellPrice.toLocaleString('id-ID')}</td>
                      <td className="table-num" style={{ color: '#059669', fontWeight: 600 }}>
                        Rp {margin.toLocaleString('id-ID')}
                      </td>
                      <td>
                        {tank ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                            [{tank.id}] {tank.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-muted-text)', fontSize: '12px' }}>
                            {cat?.name === 'Pelumas & Oli' || p.unit !== 'Liter' ? '-' : 'Belum Terhubung'}
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge variant={p.status === 'Aktif' ? 'success' : 'neutral'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditProductModal(p)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={p.status === 'Aktif' ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleToggleProduct(p)}
                            style={{ padding: '3px 8px', fontSize: '12px' }}
                          >
                            {p.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
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
      )}

      {/* MODAL INPUT TERA BARU */}
      <Modal
        isOpen={isTeraModalOpen}
        onClose={() => setIsTeraModalOpen(false)}
        title="Input Data Tera Nozzle"
      >
        <form onSubmit={handleSaveTera}>
          <div className="form-group">
            <label className="form-label">Nozzle Dispenser (Relasi ID)</label>
            <select
              className="form-select"
              value={selectedNozzleId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedNozzleId(e.target.value)}
            >
              {nozzles.map((nz) => (
                <option key={nz.id} value={nz.id}>
                  [{nz.id} • {nz.code}] {nz.productName} — {nz.island} (Tanki: {nz.tankId})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Tera Awal (Meter Totalisator)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={teraAwal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeraAwal(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tera Akhir (Meter Totalisator)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={teraAkhir}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeraAkhir(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Selisih Pengukuran (L)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={inputSelisih}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputSelisih(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--blue-50)',
              border: '1px solid var(--blue-200)',
              borderRadius: 'var(--border-radius-sm)',
              margin: '10px 0 16px 0',
              fontSize: '13px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span className="text-muted">Volume Terhitung:</span>
              <strong style={{ color: 'var(--color-primary-dark)' }}>{computedVolume.toLocaleString('id-ID')} Liter</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Penjualan:</span>
              <strong style={{ color: 'var(--color-dark-text)', fontSize: '14px' }}>Rp {computedSalesValue.toLocaleString('id-ID')}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setIsTeraModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Data Tera
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL BUKA SHIFT DINAMIS */}
      <Modal
        isOpen={isBukaShiftModalOpen}
        onClose={() => setIsBukaShiftModalOpen(false)}
        title="Buka Shift Kerja"
      >
        <form onSubmit={handleExecuteBukaShift}>
          <div className="form-group">
            <label className="form-label">Pilih Shift yang Hendak Dibuka <span className="required">*</span></label>
            <select
              className="form-select"
              value={selectedShiftToOpen}
              onChange={(e) => {
                const sid = e.target.value;
                setSelectedShiftToOpen(sid);
                const s = shifts.find(item => item.id === sid);
                if (s) {
                  setBukaStartTime(s.startTime);
                  setBukaOperator(s.operator);
                }
              }}
              required
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.name} ({s.startTime} - {s.endTime} WIB) — Status Saat Ini: {s.status}
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
                placeholder="Contoh: 06:00"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Petugas / Operator Kasir <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                value={bukaOperator}
                onChange={(e) => setBukaOperator(e.target.value)}
                placeholder="Nama petugas shift"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Modal Kas Awal (Rp)</label>
              <input
                type="number"
                className="form-control"
                value={bukaInitialCash}
                onChange={(e) => setBukaInitialCash(e.target.value)}
                placeholder="1000000"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsBukaShiftModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Aktifkan Shift Ini
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TUTUP SHIFT DINAMIS */}
      <Modal
        isOpen={isTutupShiftModalOpen}
        onClose={() => setIsTutupShiftModalOpen(false)}
        title="Tutup Sesi Shift"
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
                <span className="text-muted">Operator:</span>
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
                <strong style={{ color: 'var(--color-primary-dark)' }}>Rp {calculatedShiftSales.toLocaleString('id-ID')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontWeight: 600 }}>Total Estimasi Kas Fisik:</span>
                <strong style={{ fontSize: '14px' }}>Rp {(initialCashVal + calculatedShiftSales).toLocaleString('id-ID')}</strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Setoran Kas Fisik yang Diterima (Rp) <span className="required">*</span></label>
            <input
              type="number"
              className="form-control"
              value={tutupCashHandover}
              onChange={(e) => setTutupCashHandover(e.target.value)}
              placeholder="Masukkan nominal setoran kas fisik"
              required
              style={{ fontSize: '16px', fontWeight: 700 }}
            />
          </div>

          {tutupCashHandover && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-xs)',
                backgroundColor: computedDiscrepancy === 0 ? 'var(--blue-50)' : computedDiscrepancy > 0 ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${computedDiscrepancy === 0 ? 'var(--blue-200)' : computedDiscrepancy > 0 ? '#A7F3D0' : '#FECACA'}`,
                marginBottom: '14px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Selisih Kas (Discrepancy):</span>
                <strong style={{ color: computedDiscrepancy < 0 ? 'var(--color-danger)' : computedDiscrepancy > 0 ? '#059669' : 'var(--color-primary-dark)' }}>
                  {computedDiscrepancy === 0 ? 'Rp 0 (Pas / Seimbang)' : `Rp ${computedDiscrepancy.toLocaleString('id-ID')}`}
                </strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setIsTutupShiftModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Tutup Shift & Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TAMBAH / EDIT PRODUK BBM (CRUD PENUH) */}
      {/* MODAL TAMBAH / EDIT PRODUK BBM & OLI */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
      >
        <form onSubmit={handleSaveProduct}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Kode Produk <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={prodCode}
                onChange={(e) => setProdCode(e.target.value)}
                placeholder="Contoh: DEX / OLI-006"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Nama Produk <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Contoh: Pertamina Dex"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Kategori Produk <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                required
              >
                {productCategories
                  .filter((c) => c.status === 'Aktif' || c.id === prodCategoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.status === 'Nonaktif' ? '(Nonaktif)' : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Satuan Dasar</label>
              <input
                type="text"
                className="form-control"
                value={prodUnit}
                onChange={(e) => setProdUnit(e.target.value)}
                placeholder="Liter / Botol"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Harga Beli / DO (Rp)</label>
              <input
                type="number"
                className="form-control"
                value={prodBuyPrice}
                onChange={(e) => setProdBuyPrice(e.target.value)}
                placeholder="Contoh: 13500"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Jual (Rp)</label>
              <input
                type="number"
                className="form-control"
                value={prodSellPrice}
                onChange={(e) => setProdSellPrice(e.target.value)}
                placeholder="Contoh: 14200"
                required
              />
            </div>
          </div>

          {/* Relasi Operasional: Tanki Pendam */}
          <div className="form-group">
            <label className="form-label">Relasi Tanki Pendam (Tank ID)</label>
            <select
              className="form-select"
              value={prodTankId}
              onChange={(e) => setProdTankId(e.target.value)}
            >
              <option value="">-- Tanpa Relasi Tanki (misal Oli / Non-BBM) --</option>
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.id}] {t.name} — Kapasitas {t.capacity.toLocaleString('id-ID')} L
                </option>
              ))}
            </select>
            <span className="form-hint" style={{ marginTop: '4px' }}>
              Menghubungkan produk dengan tanki penyimpanan BBM menggunakan identifier ID resmi.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Status Produk</label>
            <select
              className="form-select"
              value={prodStatus}
              onChange={(e) => setProdStatus(e.target.value as 'Aktif' | 'Nonaktif')}
            >
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsProductModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL KELOLA KATEGORI PRODUK */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Master Kategori Produk"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <form
            onSubmit={handleSaveCategory}
            style={{
              padding: '14px',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>
              {editingCategory ? 'Edit Kategori Produk' : '+ Tambah Kategori Baru'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Kategori <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Contoh: Gas LPG / Minuman"
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={catStatus}
                  onChange={(e) => setCatStatus(e.target.value as 'Aktif' | 'Nonaktif')}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button type="submit" variant="primary" size="sm">
                  {editingCategory ? 'Simpan' : 'Tambah'}
                </Button>
                {editingCategory && (
                  <Button type="button" variant="secondary" size="sm" onClick={openAddCategory}>
                    Batal
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama Kategori</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {productCategories.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <Badge variant={c.status === 'Aktif' ? 'success' : 'neutral'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCategory(c)}
                          style={{ padding: '2px 8px', fontSize: '12px' }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={c.status === 'Aktif' ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => {
                            toggleProductCategoryStatus(c.id);
                            showToast(`Kategori [${c.name}] status diubah.`, 'primary');
                          }}
                          style={{ padding: '2px 8px', fontSize: '12px' }}
                        >
                          {c.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL TAMBAH / EDIT TANKI PENDAM */}
      <Modal
        isOpen={isTankModalOpen}
        onClose={() => setIsTankModalOpen(false)}
        title={editingTank ? 'Edit Tanki Pendam' : 'Tambah Tanki Pendam Baru'}
      >
        <form onSubmit={handleSaveTank}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                ID Tanki <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={tankId}
                onChange={(e) => setTankId(e.target.value)}
                disabled={!!editingTank}
                placeholder="Contoh: TNK-06"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Nama Tanki <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={tankName}
                onChange={(e) => setTankName(e.target.value)}
                placeholder="Contoh: Tanki Pendam 6"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Produk BBM Disimpan <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={tankProductId}
                onChange={(e) => setTankProductId(e.target.value)}
                required
              >
                <option value="">-- Pilih Produk BBM --</option>
                {products
                  .filter((p) => p.status === 'Aktif' || p.id === tankProductId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Kapasitas (Liter) <span className="required">*</span>
              </label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={tankCapacity}
                onChange={(e) => setTankCapacity(e.target.value)}
                placeholder="Contoh: 30000"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status Operasional</label>
            <select
              className="form-select"
              value={tankStatus}
              onChange={(e) => setTankStatus(e.target.value as 'Aktif' | 'Nonaktif')}
            >
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsTankModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingTank ? 'Simpan Perubahan' : 'Tambah Tanki'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL TAMBAH / EDIT NOZZLE DISPENSER */}
      <Modal
        isOpen={isNozzleModalOpen}
        onClose={() => setIsNozzleModalOpen(false)}
        title={editingNozzle ? 'Edit Nozzle Dispenser' : 'Tambah Nozzle Dispenser Baru'}
      >
        <form onSubmit={handleSaveNozzle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                ID Nozzle <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={nozzleId}
                onChange={(e) => setNozzleId(e.target.value)}
                disabled={!!editingNozzle}
                placeholder="Contoh: NZL-09"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Kode Fisik Nozzle <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={nozzleCode}
                onChange={(e) => setNozzleCode(e.target.value)}
                placeholder="Contoh: NZ-09"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Pulau Pompa Dispenser <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={nozzleIsland}
              onChange={(e) => setNozzleIsland(e.target.value)}
              placeholder="Contoh: Pulau 1 (Mobil)"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Tanki Sumber BBM <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={nozzleTankId}
                onChange={(e) => {
                  const tkId = e.target.value;
                  setNozzleTankId(tkId);
                  const tk = tanks.find((t) => t.id === tkId);
                  if (tk && tk.productId) {
                    setNozzleProductId(tk.productId);
                  }
                }}
                required
              >
                <option value="">-- Pilih Tanki Sumber --</option>
                {tanks
                  .filter((t) => t.status === 'Aktif' || t.status === 'Aman' || t.id === nozzleTankId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.id}] {t.name} ({products.find((p) => p.id === t.productId)?.name || t.productName})
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Produk BBM <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={nozzleProductId}
                onChange={(e) => setNozzleProductId(e.target.value)}
                required
              >
                <option value="">-- Pilih Produk --</option>
                {products
                  .filter((p) => p.status === 'Aktif' || p.id === nozzleProductId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">
                Totalizer / Meter Saat Ini <span className="required">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={nozzleCurrentMeter}
                onChange={(e) => setNozzleCurrentMeter(e.target.value)}
                placeholder="0.0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status Nozzle</label>
              <select
                className="form-select"
                value={nozzleStatus}
                onChange={(e) => setNozzleStatus(e.target.value as 'Aktif' | 'Maintenance' | 'Nonaktif')}
              >
                <option value="Aktif">Aktif</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsNozzleModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingNozzle ? 'Simpan Perubahan' : 'Tambah Nozzle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
