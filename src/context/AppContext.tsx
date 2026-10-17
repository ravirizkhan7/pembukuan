import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef, ReactNode } from 'react';
import * as initialMock from '../mock/mockData';
import {
  Account,
  Product,
  MasterCode,
  Tank,
  Nozzle,
  Shift,
  Tera,
  Transaction,
  StationInfo,
  ReportsData,
  Journal,
  BusinessPartner,
  Receivable,
  Payable,
  ProductCategory,
  Pegawai,
  Attendance
} from '../types';
import { getLocalDateTimeString } from '../services/appSettings';
import {
  sqliteService,
  MasterDataService,
  productCategoryRepository,
  productRepository,
  tankRepository,
  nozzleRepository,
  accountRepository,
  masterCodeRepository,
  businessPartnerRepository,
  shiftRepository,
  pegawaiRepository,
  attendanceRepository,
  teraRepository,
  accountingService,
  reportRepository
} from '../services/database';

export interface AppContextType {
  // Master Entities
  productCategories: ProductCategory[];
  accounts: Account[];
  products: Product[];
  tanks: Tank[];
  nozzles: Nozzle[];
  masterCodes: MasterCode[];
  shifts: Shift[];
  activeShift: Shift | null;
  pegawaiList: Pegawai[];
  attendances: Attendance[];
  teraList: Tera[];
  transactions: Transaction[];
  journals: Journal[];
  receivables: Receivable[];
  payables: Payable[];
  businessPartners: BusinessPartner[];
  stationInfo: StationInfo;
  authPin: string;
  reports: ReportsData;
  isDbLoaded?: boolean;

  // Master Pegawai CRUD
  addPegawai: (pegawai: Omit<Pegawai, 'id'> & { id?: string }) => Promise<Pegawai> | Pegawai;
  updatePegawai: (pegawai: Pegawai) => Promise<void> | void;
  togglePegawaiStatus: (id: string) => Promise<void> | void;
  deletePegawai?: (id: string) => Promise<boolean>;

  // Attendance Actions
  addAttendance: (attendance: Omit<Attendance, 'id'> & { id?: string }) => Promise<Attendance> | Attendance;
  updateAttendance: (attendance: Attendance) => Promise<void> | void;
  deleteAttendance: (id: string) => Promise<boolean> | void;

  // Product Category CRUD
  addProductCategory: (category: Omit<ProductCategory, 'id'> & { id?: string }) => Promise<ProductCategory> | ProductCategory;
  updateProductCategory: (category: ProductCategory) => Promise<void> | void;
  toggleProductCategoryStatus: (id: string) => Promise<void> | void;
  deleteProductCategory?: (id: string) => Promise<boolean>;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id'> & { id?: string }) => Promise<Account> | Account;
  updateAccount: (account: Account) => Promise<void> | void;
  toggleAccountStatus: (id: string) => Promise<void> | void;
  deleteAccount?: (id: string) => Promise<boolean>;

  // Product CRUD
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => Promise<Product> | Product;
  updateProduct: (product: Product) => Promise<void> | void;
  toggleProductStatus: (id: string) => Promise<void> | void;
  deleteProduct?: (id: string) => Promise<boolean>;

  // Tank CRUD
  addTank: (tank: Omit<Tank, 'id'> & { id?: string }) => Promise<Tank> | Tank;
  updateTank: (tank: Tank) => Promise<void> | void;
  toggleTankStatus: (id: string) => Promise<void> | void;
  deleteTank?: (id: string) => Promise<boolean>;

  // Nozzle CRUD
  addNozzle: (nozzle: Omit<Nozzle, 'id'> & { id?: string }) => Promise<Nozzle> | Nozzle;
  updateNozzle: (nozzle: Nozzle) => Promise<void> | void;
  toggleNozzleStatus: (id: string) => Promise<void> | void;
  deleteNozzle?: (id: string) => Promise<boolean>;

  // Master Code CRUD
  addMasterCode: (code: Omit<MasterCode, 'id'> & { id?: string }) => Promise<MasterCode> | MasterCode;
  updateMasterCode: (code: MasterCode) => Promise<void> | void;
  toggleMasterCodeStatus: (id: string) => Promise<void> | void;
  deleteMasterCode?: (id: string) => Promise<boolean>;

  // Shift Dynamic Actions
  bukaShift: (shiftId: string, params: { date: string; startTime: string; operator: string; initialCash: number }) => Promise<void> | void;
  tutupShift: (shiftId: string, params: { cashHandover: number }) => Promise<void> | void;

  // Tera & Transaction Actions
  addTera: (tera: Tera) => Promise<void> | void;
  addTransaction: (tx: Transaction, tera?: Tera) => Promise<{ success: boolean; error?: string; journal?: Journal }>;

  // Business Partner
  addBusinessPartner: (bp: Omit<BusinessPartner, 'id'> & { id?: string }) => Promise<BusinessPartner> | BusinessPartner;
  updateBusinessPartner: (id: string, updates: Partial<Omit<BusinessPartner, 'id'>> & { isActive?: boolean }) => Promise<BusinessPartner>;
  deleteBusinessPartner?: (id: string) => Promise<boolean>;

  // Reports Action
  refreshReports: (period?: string) => Promise<ReportsData>;

  // Station & Security
  updateStationInfo: (info: StationInfo) => Promise<void> | void;
  changePin: (newPin: string) => void;
  reloadFromDatabase?: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(initialMock.mockProductCategories);
  const [accounts, setAccounts] = useState<Account[]>(initialMock.mockAccounts);
  const [products, setProducts] = useState<Product[]>(initialMock.mockProducts);
  const [tanks, setTanks] = useState<Tank[]>(initialMock.mockTanks);
  const [nozzles, setNozzles] = useState<Nozzle[]>(initialMock.mockNozzles);
  const [masterCodes, setMasterCodes] = useState<MasterCode[]>(initialMock.mockMasterCodes);
  const [shifts, setShifts] = useState<Shift[]>([
    { id: "SFT-01", name: "Shift 1", startTime: "07:00", endTime: "15:00", operator: "Ahmad Fauzi", status: "Menunggu", totalSales: 0, cashHandover: 0, date: "2026-09-24", initialCash: 0, discrepancy: 0 },
    { id: "SFT-02", name: "Shift 2", startTime: "15:00", endTime: "23:00", operator: "Siti Rahma", status: "Menunggu", totalSales: 0, cashHandover: 0, date: "2026-09-24", initialCash: 0, discrepancy: 0 }
  ]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>(initialMock.mockPegawai);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [teraList, setTeraList] = useState<Tera[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [pendingTera, setPendingTera] = useState<Tera | null>(null);
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>(initialMock.mockBusinessPartners);
  const [stationInfo, setStationInfo] = useState<StationInfo>(initialMock.mockStationInfo);
  const stationInfoRef = useRef<StationInfo>(stationInfo);
  useEffect(() => {
    stationInfoRef.current = stationInfo;
  }, [stationInfo]);

  const [authPin, setAuthPin] = useState<string>(initialMock.initialAuthPin);
  const [reports, setReports] = useState<ReportsData>(initialMock.mockReports);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  // Inisialisasi SQLite database dan load master data secara persisten
  useEffect(() => {
    let isMounted = true;
    async function initDatabaseAndMasterData() {
      try {
        await sqliteService.initialize();
        await MasterDataService.initializeMasterData(sqliteService);
        const snapshot = await MasterDataService.loadAllMasterData(sqliteService);
        if (isMounted) {
          setAccounts(snapshot.accounts);
          setProductCategories(snapshot.productCategories);
          setProducts(snapshot.products);
          setTanks(snapshot.tanks);
          setNozzles(snapshot.nozzles);
          setMasterCodes(snapshot.masterCodes);
          setBusinessPartners(snapshot.businessPartners);
          setShifts(snapshot.shifts);
          setPegawaiList(snapshot.pegawaiList);
          setAttendances(snapshot.attendances);
          setTransactions(snapshot.transactions);
          setTeraList(snapshot.teraList);
          setJournals(snapshot.journals);
          setReceivables(snapshot.receivables);
          setPayables(snapshot.payables);
          if (snapshot.reports) {
            setReports(snapshot.reports);
          }
          if (snapshot.stationInfo) {
            setStationInfo(snapshot.stationInfo);
          }
          setIsDbLoaded(true);
        }
      } catch (err) {
        console.warn('[AppContext] Inisialisasi database SQLite atau master data warning:', err);
      }
    }

    initDatabaseAndMasterData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Memuat ulang seluruh data dari SQLite setelah Restore atau sinkronisasi eksternal
  const reloadFromDatabase = useCallback(async (): Promise<void> => {
    try {
      const snapshot = await MasterDataService.loadAllMasterData(sqliteService);
      setAccounts(snapshot.accounts);
      setProductCategories(snapshot.productCategories);
      setProducts(snapshot.products);
      setTanks(snapshot.tanks);
      setNozzles(snapshot.nozzles);
      setMasterCodes(snapshot.masterCodes);
      setBusinessPartners(snapshot.businessPartners);
      setShifts(snapshot.shifts);
      setPegawaiList(snapshot.pegawaiList);
      setAttendances(snapshot.attendances);
      setTransactions(snapshot.transactions);
      setTeraList(snapshot.teraList);
      setJournals(snapshot.journals);
      setReceivables(snapshot.receivables);
      setPayables(snapshot.payables);
      if (snapshot.reports) {
        setReports(snapshot.reports);
      }
      if (snapshot.stationInfo) {
        setStationInfo(snapshot.stationInfo);
      }
    } catch (err) {
      console.error('[AppContext] Gagal memuat ulang data dari SQLite:', err);
      throw err;
    }
  }, []);

  // Active shift is strictly the one with status === 'Aktif'
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === 'Aktif') || null;
  }, [shifts]);

  // ==========================================
  // A. Bagan Akun (COA) CRUD (SQLite Persisted)
  // ==========================================
  const addAccount = useCallback(async (accountData: Omit<Account, 'id'> & { id?: string }): Promise<Account> => {
    const newId = accountData.id || accountData.code;
    const newAcc: Account = {
      ...accountData,
      id: newId,
      balance: accountData.balance ?? 0,
      isActive: accountData.isActive ?? true
    };
    await accountRepository.create(newAcc);
    setAccounts((prev) => [...prev.filter((a) => a.id !== newAcc.id), newAcc]);
    return newAcc;
  }, []);

  const updateAccount = useCallback(async (updated: Account): Promise<void> => {
    await accountRepository.update(updated.id, {
      code: updated.code,
      name: updated.name,
      category: updated.category,
      normalBalance: updated.normalBalance,
      balance: updated.balance,
      isActive: updated.isActive
    });
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updated.id ? updated : acc))
    );
  }, []);

  const toggleAccountStatus = useCallback(async (id: string): Promise<void> => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const nextIsActive = !acc.isActive;
    await accountRepository.update(id, { isActive: nextIsActive });
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: nextIsActive } : a))
    );
  }, [accounts]);

  const deleteAccount = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await accountRepository.delete(id);
    if (deleted) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // B. Produk CRUD (SQLite Persisted + Relasi Tanki)
  // ==========================================
  const addProduct = useCallback(async (prodData: Omit<Product, 'id'> & { id?: string }): Promise<Product> => {
    const newId = prodData.id || `PRD-${Date.now().toString().slice(-4)}`;
    const newProd: Product = {
      ...prodData,
      id: newId,
      status: prodData.status || 'Aktif'
    };
    await productRepository.create(newProd);
    setProducts((prev) => [...prev.filter((p) => p.id !== newProd.id), newProd]);

    // Jika produk mengaitkan tankId, sinkronkan relasi tanki
    if (newProd.tankId) {
      try {
        await tankRepository.update(newProd.tankId, { productId: newProd.id });
      } catch (e) {
        console.warn('[AppContext] Sinkronisasi link produk ke tanki:', e);
      }
      setTanks((prevTanks) =>
        prevTanks.map((t) =>
          t.id === newProd.tankId
            ? { ...t, productId: newProd.id, productName: newProd.name }
            : t
        )
      );
    }

    return newProd;
  }, []);

  const updateProduct = useCallback(async (updated: Product): Promise<void> => {
    await productRepository.update(updated.id, {
      code: updated.code,
      name: updated.name,
      categoryId: updated.categoryId,
      sellPrice: updated.sellPrice,
      buyPrice: updated.buyPrice,
      unit: updated.unit,
      color: updated.color,
      status: updated.status,
      tankId: updated.tankId
    });
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );

    // Sinkronisasi relasi tanki jika berubah
    if (updated.tankId) {
      try {
        await tankRepository.update(updated.tankId, { productId: updated.id });
      } catch (e) {
        console.warn('[AppContext] Sinkronisasi link produk ke tanki on update:', e);
      }
      setTanks((prevTanks) =>
        prevTanks.map((t) =>
          t.id === updated.tankId
            ? { ...t, productId: updated.id, productName: updated.name }
            : t
        )
      );
    }
  }, []);

  const toggleProductStatus = useCallback(async (id: string): Promise<void> => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const nextStatus = prod.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    await productRepository.update(id, { status: nextStatus });
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: nextStatus } : p))
    );
  }, [products]);

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await productRepository.delete(id);
    if (deleted) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // B.1. Kategori Produk CRUD (SQLite Persisted)
  // ==========================================
  const addProductCategory = useCallback(async (catData: Omit<ProductCategory, 'id'> & { id?: string }): Promise<ProductCategory> => {
    const newId = catData.id || `PCAT-${(productCategories.length + 1).toString().padStart(3, '0')}`;
    const newCat: ProductCategory = {
      ...catData,
      id: newId,
      status: catData.status || 'Aktif'
    };
    await productCategoryRepository.create(newCat);
    setProductCategories((prev) => [...prev.filter((c) => c.id !== newCat.id), newCat]);
    return newCat;
  }, [productCategories.length]);

  const updateProductCategory = useCallback(async (updated: ProductCategory): Promise<void> => {
    await productCategoryRepository.update(updated.id, {
      name: updated.name,
      status: updated.status
    });
    setProductCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const toggleProductCategoryStatus = useCallback(async (id: string): Promise<void> => {
    const cat = productCategories.find((c) => c.id === id);
    if (!cat) return;
    const nextStatus = cat.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    await productCategoryRepository.update(id, { status: nextStatus });
    setProductCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
    );
  }, [productCategories]);

  const deleteProductCategory = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await productCategoryRepository.delete(id);
    if (deleted) {
      setProductCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // B.2. Tanki Pendam CRUD (SQLite Persisted)
  // ==========================================
  const addTank = useCallback(async (tankData: Omit<Tank, 'id'> & { id?: string }): Promise<Tank> => {
    const newId = tankData.id || `TNK-${(tanks.length + 1).toString().padStart(2, '0')}`;
    const linkedProd = products.find((p) => p.id === tankData.productId);
    const newTank: Tank = {
      ...tankData,
      id: newId,
      productName: linkedProd?.name || tankData.productName || 'BBM',
      currentStock: tankData.currentStock ?? 0,
      unit: tankData.unit || 'Liter',
      lastSounding: tankData.lastSounding || getLocalDateTimeString(),
      status: tankData.status || 'Aktif'
    };
    await tankRepository.create(newTank);
    setTanks((prev) => [...prev.filter((t) => t.id !== newTank.id), newTank]);
    return newTank;
  }, [products, tanks.length]);

  const updateTank = useCallback(async (updated: Tank): Promise<void> => {
    const linkedProd = products.find((p) => p.id === updated.productId);
    const enrichedTank: Tank = {
      ...updated,
      productName: linkedProd?.name || updated.productName
    };
    await tankRepository.update(updated.id, {
      name: updated.name,
      productId: updated.productId,
      capacity: updated.capacity,
      currentStock: updated.currentStock,
      unit: updated.unit,
      lastSounding: updated.lastSounding,
      status: updated.status
    });
    setTanks((prev) =>
      prev.map((t) => (t.id === updated.id ? enrichedTank : t))
    );
  }, [products]);

  const toggleTankStatus = useCallback(async (id: string): Promise<void> => {
    const t = tanks.find((tank) => tank.id === id);
    if (!t) return;
    const nextStatus = t.status === 'Aktif' || t.status === 'Aman' ? 'Nonaktif' : 'Aktif';
    await tankRepository.update(id, { status: nextStatus });
    setTanks((prev) =>
      prev.map((tank) => (tank.id === id ? { ...tank, status: nextStatus } : tank))
    );
  }, [tanks]);

  const deleteTank = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await tankRepository.delete(id);
    if (deleted) {
      setTanks((prev) => prev.filter((t) => t.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // B.3. Nozzle Dispenser CRUD (SQLite Persisted)
  // ==========================================
  const addNozzle = useCallback(async (nozzleData: Omit<Nozzle, 'id'> & { id?: string }): Promise<Nozzle> => {
    const newId = nozzleData.id || `NZL-${(nozzles.length + 1).toString().padStart(2, '0')}`;
    const linkedProd = products.find((p) => p.id === nozzleData.productId);
    const newNozzle: Nozzle = {
      ...nozzleData,
      id: newId,
      productName: linkedProd?.name || nozzleData.productName || 'BBM',
      currentMeter: nozzleData.currentMeter ?? 0,
      status: nozzleData.status || 'Aktif'
    };
    await nozzleRepository.create(newNozzle);
    setNozzles((prev) => [...prev.filter((n) => n.id !== newNozzle.id), newNozzle]);
    return newNozzle;
  }, [products, nozzles.length]);

  const updateNozzle = useCallback(async (updated: Nozzle): Promise<void> => {
    const linkedProd = products.find((p) => p.id === updated.productId);
    const enrichedNozzle: Nozzle = {
      ...updated,
      productName: linkedProd?.name || updated.productName
    };
    await nozzleRepository.update(updated.id, {
      code: updated.code,
      island: updated.island,
      tankId: updated.tankId,
      productId: updated.productId,
      currentMeter: updated.currentMeter,
      status: updated.status
    });
    setNozzles((prev) =>
      prev.map((n) => (n.id === updated.id ? enrichedNozzle : n))
    );
  }, [products]);

  const toggleNozzleStatus = useCallback(async (id: string): Promise<void> => {
    const n = nozzles.find((noz) => noz.id === id);
    if (!n) return;
    const nextStatus = n.status === 'Aktif' ? 'Maintenance' : 'Aktif';
    await nozzleRepository.update(id, { status: nextStatus });
    setNozzles((prev) =>
      prev.map((noz) => (noz.id === id ? { ...noz, status: nextStatus } : noz))
    );
  }, [nozzles]);

  const deleteNozzle = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await nozzleRepository.delete(id);
    if (deleted) {
      setNozzles((prev) => prev.filter((n) => n.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // C. Master Kode CRUD (SQLite Persisted)
  // ==========================================
  const addMasterCode = useCallback(async (mcData: Omit<MasterCode, 'id'> & { id?: string }): Promise<MasterCode> => {
    const newId = mcData.id || `MK-${mcData.code}`;
    const newMc: MasterCode = {
      ...mcData,
      id: newId,
      isActive: mcData.isActive ?? true
    };
    await masterCodeRepository.create(newMc);
    setMasterCodes((prev) => [...prev.filter((m) => m.id !== newMc.id), newMc]);
    return newMc;
  }, []);

  const updateMasterCode = useCallback(async (updated: MasterCode): Promise<void> => {
    await masterCodeRepository.update(updated.id, {
      code: updated.code,
      name: updated.name,
      category: updated.category,
      type: updated.type,
      requiresTera: updated.requiresTera,
      productId: updated.productId,
      unitPrice: updated.unitPrice,
      debitAccountId: updated.debitAccountId,
      creditAccountId: updated.creditAccountId,
      description: updated.description,
      paymentMethod: updated.paymentMethod,
      isActive: updated.isActive
    });
    setMasterCodes((prev) =>
      prev.map((mc) => (mc.id === updated.id ? updated : mc))
    );
  }, []);

  const toggleMasterCodeStatus = useCallback(async (id: string): Promise<void> => {
    const mc = masterCodes.find((m) => m.id === id);
    if (!mc) return;
    const nextIsActive = !mc.isActive;
    await masterCodeRepository.update(id, { isActive: nextIsActive });
    setMasterCodes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive: nextIsActive } : m))
    );
  }, [masterCodes]);

  const deleteMasterCode = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await masterCodeRepository.delete(id);
    if (deleted) {
      setMasterCodes((prev) => prev.filter((m) => m.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // D. Shift Dinamis (Buka & Tutup) - SQLite Persisted
  // ==========================================
  const bukaShift = useCallback(async (
    shiftId: string,
    params: { date: string; startTime: string; operator: string; initialCash: number }
  ): Promise<void> => {
    await shiftRepository.bukaShift(shiftId, params);
    const updated = await shiftRepository.getAllShifts();
    setShifts(updated);
  }, []);

  const tutupShift = useCallback(async (
    shiftId: string,
    params: { cashHandover: number }
  ): Promise<void> => {
    const shiftTransactions = transactions.filter((tx) => tx.shiftId === shiftId && tx.status === 'Selesai');
    const totalSales = shiftTransactions
      .filter((tx) => tx.category === 'Penjualan')
      .reduce((acc, tx) => acc + (tx.total || 0), 0);
    const cashSales = shiftTransactions
      .filter((tx) => tx.paymentMethod === 'Tunai' && tx.category === 'Penjualan')
      .reduce((acc, tx) => acc + (tx.total || 0), 0);

    await shiftRepository.tutupShift(shiftId, {
      cashHandover: params.cashHandover,
      computedSales: totalSales,
      computedCashSales: cashSales
    });
    const updated = await shiftRepository.getAllShifts();
    setShifts(updated);
  }, [transactions]);

  // ==========================================
  // E. Tera & Transaksi (Relasional + Posting Engine ke SQLite)
  // ==========================================
  const addTera = useCallback(async (tera: Tera): Promise<void> => {
    if (!tera.transactionId) {
      await teraRepository.create(tera);
      setTeraList((prev) => [tera, ...prev.filter((t) => t.id !== tera.id)]);
    } else {
      setPendingTera(tera);
      setTeraList((prev) => [tera, ...prev.filter((t) => t.id !== tera.id)]);
    }
  }, []);

  const addTransaction = useCallback(async (
    tx: Transaction,
    teraParam?: Tera
  ): Promise<{ success: boolean; error?: string; journal?: Journal }> => {
    const teraToPost =
      teraParam ||
      (tx.teraId
        ? pendingTera?.id === tx.teraId
          ? pendingTera
          : teraList.find((t) => t.id === tx.teraId)
        : undefined);

    const postResult = await accountingService.executeTransaction({
      transaction: tx,
      tera: teraToPost
    });

    if (!postResult.success) {
      return {
        success: false,
        error: postResult.error
      };
    }

    if (postResult.transaction) {
      setTransactions((prev) => [postResult.transaction!, ...prev.filter((t) => t.id !== postResult.transaction!.id)]);
    }
    if (postResult.tera) {
      setTeraList((prev) => [postResult.tera!, ...prev.filter((t) => t.id !== postResult.tera!.id)]);
    }
    if (postResult.journal) {
      setJournals((prev) => [postResult.journal!, ...prev.filter((j) => j.id !== postResult.journal!.id)]);
    }
    if (postResult.updatedAccounts) {
      setAccounts(postResult.updatedAccounts);
    }
    if (postResult.updatedReceivables) {
      setReceivables(postResult.updatedReceivables);
    }
    if (postResult.updatedPayables) {
      setPayables(postResult.updatedPayables);
    }
    if (postResult.updatedShifts) {
      setShifts(postResult.updatedShifts);
    }
    setPendingTera(null);

    // Refresh reports dari SQLite secara asinkron
    reportRepository.getAllReports(undefined, stationInfoRef.current).then((rep) => {
      setReports(rep);
    }).catch(console.error);

    return {
      success: true,
      journal: postResult.journal
    };
  }, [pendingTera, teraList]);

  const refreshReports = useCallback(async (period?: string): Promise<ReportsData> => {
    try {
      const data = await reportRepository.getAllReports(period, stationInfoRef.current);
      setReports(data);
      return data;
    } catch (err) {
      console.error('[AppContext] Gagal me-refresh laporan:', err);
      throw err;
    }
  }, []);

  // ==========================================
  // F. Business Partner (SQLite Persisted)
  // ==========================================
  const addBusinessPartner = useCallback(async (bp: Omit<BusinessPartner, 'id'> & { id?: string }): Promise<BusinessPartner> => {
    const newId = bp.id || `BP-${Date.now().toString().slice(-4)}`;
    const newPartner: BusinessPartner = {
      ...bp,
      id: newId,
      isActive: bp.isActive !== undefined ? bp.isActive : true
    };
    await businessPartnerRepository.create(newPartner);
    setBusinessPartners((prev) => [...prev.filter((p) => p.id !== newPartner.id), newPartner]);
    return newPartner;
  }, []);

  const updateBusinessPartner = useCallback(async (id: string, updates: Partial<Omit<BusinessPartner, 'id'>> & { isActive?: boolean }): Promise<BusinessPartner> => {
    const updated = await businessPartnerRepository.update(id, updates);
    setBusinessPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, []);

  const deleteBusinessPartner = useCallback(async (id: string): Promise<boolean> => {
    const isRef = await businessPartnerRepository.isReferenced(id);
    if (isRef) {
      throw new Error('Mitra bisnis tidak dapat dihapus karena sudah memiliki riwayat transaksi atau tagihan terkait. Anda dapat menonaktifkan statusnya.');
    }
    const deleted = await businessPartnerRepository.delete(id);
    if (deleted) {
      setBusinessPartners((prev) => prev.filter((p) => p.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // G. Master Pegawai CRUD (SQLite Persisted)
  // ==========================================
  const addPegawai = useCallback(async (pData: Omit<Pegawai, 'id'> & { id?: string }): Promise<Pegawai> => {
    const nextNum = pegawaiList.length + 1;
    const padded = nextNum.toString().padStart(3, '0');
    const newId = pData.id || `OPR-${padded}`;
    const newPegawai: Pegawai = {
      ...pData,
      id: newId,
      status: pData.status || 'Aktif'
    };
    const saved = await pegawaiRepository.create(newPegawai);
    setPegawaiList((prev) => [...prev.filter((p) => p.id !== saved.id), saved]);
    return saved;
  }, [pegawaiList.length]);

  const updatePegawai = useCallback(async (updated: Pegawai): Promise<void> => {
    const saved = await pegawaiRepository.update(updated.id, {
      name: updated.name,
      role: updated.role,
      status: updated.status,
      shiftId: updated.shiftId
    });
    setPegawaiList((prev) =>
      prev.map((p) => (p.id === saved.id ? saved : p))
    );
  }, []);

  const togglePegawaiStatus = useCallback(async (id: string): Promise<void> => {
    const saved = await pegawaiRepository.toggleStatus(id);
    setPegawaiList((prev) =>
      prev.map((p) => (p.id === id ? saved : p))
    );
  }, []);

  const deletePegawai = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await pegawaiRepository.delete(id);
    if (deleted) {
      setPegawaiList((prev) => prev.filter((p) => p.id !== id));
    }
    return deleted;
  }, []);

  // ==========================================
  // H. Absensi & Kehadiran Pegawai (SQLite Persisted)
  // ==========================================
  const addAttendance = useCallback(async (attData: Omit<Attendance, 'id'> & { id?: string }): Promise<Attendance> => {
    const newId = attData.id || `ATT-${Date.now().toString().slice(-6)}`;
    const newAtt: Attendance = {
      ...attData,
      id: newId
    };
    const saved = await attendanceRepository.create(newAtt);
    setAttendances((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);
    return saved;
  }, []);

  const updateAttendance = useCallback(async (updated: Attendance): Promise<void> => {
    const saved = await attendanceRepository.update(updated.id, updated);
    setAttendances((prev) =>
      prev.map((att) => (att.id === saved.id ? saved : att))
    );
  }, []);

  const deleteAttendance = useCallback(async (id: string): Promise<boolean> => {
    const deleted = await attendanceRepository.delete(id);
    if (deleted) {
      setAttendances((prev) => prev.filter((att) => att.id !== id));
    }
    return deleted;
  }, []);

  const updateStationInfo = useCallback(async (info: StationInfo): Promise<void> => {
    const now = new Date().toISOString();
    const existingStation = await sqliteService.query<any>('SELECT id FROM station_info LIMIT 1;');
    if (existingStation && existingStation.length > 0) {
      const existingId = existingStation[0].id;
      await sqliteService.run(
        `UPDATE station_info SET
           id = ?,
           name = ?,
           address = ?,
           city = ?,
           phone = ?,
           manager = ?,
           email = ?,
           status = ?,
           updated_at = ?
         WHERE id = ?;`,
        [
          info.id,
          info.name,
          info.address,
          info.city && info.city.trim() !== '' ? info.city.trim() : null,
          info.phone,
          info.manager,
          info.email,
          info.status,
          now,
          existingId
        ]
      );
    } else {
      await sqliteService.run(
        `INSERT INTO station_info (
           id, name, address, city, phone, manager, email, status, last_backup, version, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          info.id,
          info.name,
          info.address,
          info.city && info.city.trim() !== '' ? info.city.trim() : null,
          info.phone,
          info.manager,
          info.email,
          info.status,
          info.lastBackup || null,
          info.version || '1.0.0',
          now,
          now
        ]
      );
    }

    setStationInfo(info);
    stationInfoRef.current = info;

    try {
      await refreshReports();
    } catch (rErr) {
      console.warn('[AppContext] Refresh reports after updating station info warning:', rErr);
    }
  }, [refreshReports]);

  const changePin = useCallback((newPin: string) => {
    setAuthPin(newPin);
  }, []);

  const value: AppContextType = useMemo(() => ({
    productCategories,
    accounts,
    products,
    tanks,
    nozzles,
    masterCodes,
    shifts,
    activeShift,
    pegawaiList,
    attendances,
    teraList,
    transactions,
    journals,
    receivables,
    payables,
    businessPartners,
    stationInfo,
    authPin,
    reports,
    isDbLoaded,
    addProductCategory,
    updateProductCategory,
    toggleProductCategoryStatus,
    deleteProductCategory,
    addAccount,
    updateAccount,
    toggleAccountStatus,
    deleteAccount,
    addProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    addTank,
    updateTank,
    toggleTankStatus,
    deleteTank,
    addNozzle,
    updateNozzle,
    toggleNozzleStatus,
    deleteNozzle,
    addMasterCode,
    updateMasterCode,
    toggleMasterCodeStatus,
    deleteMasterCode,
    bukaShift,
    tutupShift,
    addTera,
    addTransaction,
    addBusinessPartner,
    updateBusinessPartner,
    deleteBusinessPartner,
    addPegawai,
    updatePegawai,
    togglePegawaiStatus,
    deletePegawai,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    refreshReports,
    updateStationInfo,
    changePin,
    reloadFromDatabase
  }), [
    productCategories,
    accounts,
    products,
    tanks,
    nozzles,
    masterCodes,
    shifts,
    activeShift,
    pegawaiList,
    attendances,
    teraList,
    transactions,
    journals,
    receivables,
    payables,
    businessPartners,
    stationInfo,
    authPin,
    reports,
    isDbLoaded,
    addProductCategory,
    updateProductCategory,
    toggleProductCategoryStatus,
    deleteProductCategory,
    addAccount,
    updateAccount,
    toggleAccountStatus,
    deleteAccount,
    addProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    addTank,
    updateTank,
    toggleTankStatus,
    deleteTank,
    addNozzle,
    updateNozzle,
    toggleNozzleStatus,
    deleteNozzle,
    addMasterCode,
    updateMasterCode,
    toggleMasterCodeStatus,
    deleteMasterCode,
    bukaShift,
    tutupShift,
    addTera,
    addTransaction,
    addBusinessPartner,
    updateBusinessPartner,
    deleteBusinessPartner,
    addPegawai,
    updatePegawai,
    togglePegawaiStatus,
    deletePegawai,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    refreshReports,
    updateStationInfo,
    changePin,
    reloadFromDatabase
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
