import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
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
  ProductCategory
} from '../types';
import { postTransaction } from '../services/postingEngine';

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
  teraList: Tera[];
  transactions: Transaction[];
  journals: Journal[];
  receivables: Receivable[];
  payables: Payable[];
  businessPartners: BusinessPartner[];
  stationInfo: StationInfo;
  authPin: string;
  reports: ReportsData;

  // Product Category CRUD
  addProductCategory: (category: Omit<ProductCategory, 'id'> & { id?: string }) => ProductCategory;
  updateProductCategory: (category: ProductCategory) => void;
  toggleProductCategoryStatus: (id: string) => void;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id'> & { id?: string }) => Account;
  updateAccount: (account: Account) => void;
  toggleAccountStatus: (id: string) => void;

  // Product CRUD
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => Product;
  updateProduct: (product: Product) => void;
  toggleProductStatus: (id: string) => void;

  // Tank CRUD
  addTank: (tank: Omit<Tank, 'id'> & { id?: string }) => Tank;
  updateTank: (tank: Tank) => void;
  toggleTankStatus: (id: string) => void;

  // Nozzle CRUD
  addNozzle: (nozzle: Omit<Nozzle, 'id'> & { id?: string }) => Nozzle;
  updateNozzle: (nozzle: Nozzle) => void;
  toggleNozzleStatus: (id: string) => void;

  // Master Code CRUD
  addMasterCode: (code: Omit<MasterCode, 'id'> & { id?: string }) => MasterCode;
  updateMasterCode: (code: MasterCode) => void;
  toggleMasterCodeStatus: (id: string) => void;

  // Shift Dynamic Actions
  bukaShift: (shiftId: string, params: { date: string; startTime: string; operator: string; initialCash: number }) => void;
  tutupShift: (shiftId: string, params: { cashHandover: number }) => void;

  // Tera & Transaction Actions
  addTera: (tera: Tera) => void;
  addTransaction: (tx: Transaction) => { success: boolean; error?: string; journal?: Journal };

  // Business Partner
  addBusinessPartner: (bp: Omit<BusinessPartner, 'id'> & { id?: string }) => BusinessPartner;

  // Station & Security
  updateStationInfo: (info: StationInfo) => void;
  changePin: (newPin: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(initialMock.mockProductCategories);
  const [accounts, setAccounts] = useState<Account[]>(initialMock.mockAccounts);
  const [products, setProducts] = useState<Product[]>(initialMock.mockProducts);
  const [tanks, setTanks] = useState<Tank[]>(initialMock.mockTanks);
  const [nozzles, setNozzles] = useState<Nozzle[]>(initialMock.mockNozzles);
  const [masterCodes, setMasterCodes] = useState<MasterCode[]>(initialMock.mockMasterCodes);
  const [shifts, setShifts] = useState<Shift[]>(initialMock.mockShifts);
  const [teraList, setTeraList] = useState<Tera[]>(initialMock.mockTera);
  const [transactions, setTransactions] = useState<Transaction[]>(initialMock.mockTransactions);
  const [journals, setJournals] = useState<Journal[]>(initialMock.mockJournal);
  const [receivables, setReceivables] = useState<Receivable[]>(initialMock.mockReceivables);
  const [payables, setPayables] = useState<Payable[]>(initialMock.mockPayables);
  const [businessPartners, setBusinessPartners] = useState<BusinessPartner[]>(initialMock.mockBusinessPartners);
  const [stationInfo, setStationInfo] = useState<StationInfo>(initialMock.mockStationInfo);
  const [authPin, setAuthPin] = useState<string>(initialMock.initialAuthPin);
  const [reports] = useState<ReportsData>(initialMock.mockReports);

  // Active shift is strictly the one with status === 'Aktif'
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === 'Aktif') || null;
  }, [shifts]);

  // ==========================================
  // A. Bagan Akun (COA) CRUD
  // ==========================================
  const addAccount = (accountData: Omit<Account, 'id'> & { id?: string }): Account => {
    const newId = accountData.id || accountData.code;
    const newAcc: Account = {
      ...accountData,
      id: newId,
      isActive: accountData.isActive ?? true
    };
    setAccounts((prev) => [...prev, newAcc]);
    return newAcc;
  };

  const updateAccount = (updated: Account) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updated.id ? updated : acc))
    );
  };

  const toggleAccountStatus = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, isActive: !acc.isActive } : acc))
    );
  };

  // ==========================================
  // B. Produk CRUD (dengan relasi tankId)
  // ==========================================
  const addProduct = (prodData: Omit<Product, 'id'> & { id?: string }): Product => {
    const newId = prodData.id || `PRD-${Date.now().toString().slice(-4)}`;
    const newProd: Product = {
      ...prodData,
      id: newId,
      status: prodData.status || 'Aktif'
    };
    setProducts((prev) => [...prev, newProd]);

    // If tankId assigned, sync tank's productId
    if (newProd.tankId) {
      setTanks((prevTanks) =>
        prevTanks.map((t) =>
          t.id === newProd.tankId
            ? { ...t, productId: newProd.id, productName: newProd.name }
            : t
        )
      );
    }

    return newProd;
  };

  const updateProduct = (updated: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );

    // Sync tank relation if changed
    if (updated.tankId) {
      setTanks((prevTanks) =>
        prevTanks.map((t) =>
          t.id === updated.tankId
            ? { ...t, productId: updated.id, productName: updated.name }
            : t
        )
      );
    }
  };

  const toggleProductStatus = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextStatus = p.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  // ==========================================
  // B.1. Kategori Produk CRUD
  // ==========================================
  const addProductCategory = (catData: Omit<ProductCategory, 'id'> & { id?: string }): ProductCategory => {
    const newId = catData.id || `PCAT-${(productCategories.length + 1).toString().padStart(3, '0')}`;
    const newCat: ProductCategory = {
      ...catData,
      id: newId,
      status: catData.status || 'Aktif'
    };
    setProductCategories((prev) => [...prev, newCat]);
    return newCat;
  };

  const updateProductCategory = (updated: ProductCategory) => {
    setProductCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const toggleProductCategoryStatus = (id: string) => {
    setProductCategories((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  // ==========================================
  // B.2. Tanki Pendam CRUD
  // ==========================================
  const addTank = (tankData: Omit<Tank, 'id'> & { id?: string }): Tank => {
    const newId = tankData.id || `TNK-${(tanks.length + 1).toString().padStart(2, '0')}`;
    const linkedProd = products.find((p) => p.id === tankData.productId);
    const newTank: Tank = {
      ...tankData,
      id: newId,
      productName: linkedProd?.name || tankData.productName || 'BBM',
      currentStock: tankData.currentStock ?? 0,
      unit: tankData.unit || 'Liter',
      lastSounding: tankData.lastSounding || new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: tankData.status || 'Aktif'
    };
    setTanks((prev) => [...prev, newTank]);
    return newTank;
  };

  const updateTank = (updated: Tank) => {
    const linkedProd = products.find((p) => p.id === updated.productId);
    const enrichedTank: Tank = {
      ...updated,
      productName: linkedProd?.name || updated.productName
    };
    setTanks((prev) =>
      prev.map((t) => (t.id === updated.id ? enrichedTank : t))
    );
  };

  const toggleTankStatus = (id: string) => {
    setTanks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'Aktif' || t.status === 'Aman' ? 'Nonaktif' : 'Aktif';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  // ==========================================
  // B.3. Nozzle Dispenser CRUD
  // ==========================================
  const addNozzle = (nozzleData: Omit<Nozzle, 'id'> & { id?: string }): Nozzle => {
    const newId = nozzleData.id || `NZL-${(nozzles.length + 1).toString().padStart(2, '0')}`;
    const linkedProd = products.find((p) => p.id === nozzleData.productId);
    const newNozzle: Nozzle = {
      ...nozzleData,
      id: newId,
      productName: linkedProd?.name || nozzleData.productName || 'BBM',
      currentMeter: nozzleData.currentMeter ?? 0,
      status: nozzleData.status || 'Aktif'
    };
    setNozzles((prev) => [...prev, newNozzle]);
    return newNozzle;
  };

  const updateNozzle = (updated: Nozzle) => {
    const linkedProd = products.find((p) => p.id === updated.productId);
    const enrichedNozzle: Nozzle = {
      ...updated,
      productName: linkedProd?.name || updated.productName
    };
    setNozzles((prev) =>
      prev.map((n) => (n.id === updated.id ? enrichedNozzle : n))
    );
  };

  const toggleNozzleStatus = (id: string) => {
    setNozzles((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const nextStatus = n.status === 'Aktif' ? 'Maintenance' : 'Aktif';
          return { ...n, status: nextStatus };
        }
        return n;
      })
    );
  };

  // ==========================================
  // C. Master Kode CRUD (dengan mapping COA & Produk)
  // ==========================================
  const addMasterCode = (mcData: Omit<MasterCode, 'id'> & { id?: string }): MasterCode => {
    const newId = mcData.id || `MK-${mcData.code}`;
    const newMc: MasterCode = {
      ...mcData,
      id: newId,
      isActive: mcData.isActive ?? true
    };
    setMasterCodes((prev) => [...prev, newMc]);
    return newMc;
  };

  const updateMasterCode = (updated: MasterCode) => {
    setMasterCodes((prev) =>
      prev.map((mc) => (mc.id === updated.id ? updated : mc))
    );
  };

  const toggleMasterCodeStatus = (id: string) => {
    setMasterCodes((prev) =>
      prev.map((mc) => (mc.id === id ? { ...mc, isActive: !mc.isActive } : mc))
    );
  };

  // ==========================================
  // D. Shift Dinamis (Buka & Tutup)
  // ==========================================
  const bukaShift = (
    shiftId: string,
    params: { date: string; startTime: string; operator: string; initialCash: number }
  ) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id === shiftId) {
          return {
            ...s,
            status: 'Aktif',
            date: params.date,
            startTime: params.startTime,
            operator: params.operator,
            initialCash: params.initialCash,
            totalSales: 0,
            cashHandover: 0,
            discrepancy: 0
          };
        }
        return s;
      })
    );
  };

  const tutupShift = (
    shiftId: string,
    params: { cashHandover: number }
  ) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id === shiftId) {
          // Calculate shift sales from transactions of this shift
          const shiftTransactions = transactions.filter((tx) => tx.shiftId === shiftId);
          const computedSales = shiftTransactions.reduce((acc, tx) => acc + (tx.total || 0), 0);
          const finalSales = computedSales > 0 ? computedSales : s.totalSales;
          const initial = s.initialCash || 0;
          // Kas fisik yang disetor dikurangi (modal awal + penjualan)
          const discrepancy = params.cashHandover - (initial + finalSales);

          return {
            ...s,
            status: 'Tutup',
            totalSales: finalSales,
            cashHandover: params.cashHandover,
            discrepancy
          };
        }
        return s;
      })
    );
  };

  // ==========================================
  // E. Tera & Transaksi (Relasional + Posting Engine)
  // ==========================================
  const addTera = (tera: Tera) => {
    setTeraList((prev) => [tera, ...prev]);
  };

  const addTransaction = (tx: Transaction): { success: boolean; error?: string; journal?: Journal } => {
    if (!activeShift) {
      return {
        success: false,
        error: 'Belum ada shift aktif. Buka shift terlebih dahulu di menu Monitoring → Shift Kerja.'
      };
    }

    const transactionToPost: Transaction = {
      ...tx,
      shiftId: activeShift.id,
      shift: activeShift.name
    };

    // Jalankan Accounting Posting Engine Terpusat
    const postResult = postTransaction({
      transaction: transactionToPost,
      masterCodes,
      accounts,
      businessPartners,
      receivables,
      payables
    });

    if (!postResult.success) {
      return {
        success: false,
        error: postResult.error
      };
    }

    // Mutasi Atomik: Update transaksi, jurnal umum, saldo akun COA, dan buku pembantu
    setTransactions((prev) => [transactionToPost, ...prev]);
    if (postResult.journal) {
      setJournals((prev) => [postResult.journal!, ...prev]);
    }
    setAccounts(postResult.updatedAccounts);
    setReceivables(postResult.updatedReceivables);
    setPayables(postResult.updatedPayables);

    // Update akumulasi penjualan pada shift aktif
    setShifts((prevShifts) =>
      prevShifts.map((s) =>
        s.id === activeShift.id ? { ...s, totalSales: s.totalSales + transactionToPost.total } : s
      )
    );

    return {
      success: true,
      journal: postResult.journal
    };
  };

  // ==========================================
  // F. Business Partner
  // ==========================================
  const addBusinessPartner = (bp: Omit<BusinessPartner, 'id'> & { id?: string }): BusinessPartner => {
    const newId = bp.id || `BP-${Date.now().toString().slice(-4)}`;
    const newPartner: BusinessPartner = {
      ...bp,
      id: newId
    };
    setBusinessPartners((prev) => [...prev, newPartner]);
    return newPartner;
  };

  const updateStationInfo = (info: StationInfo) => {
    setStationInfo(info);
  };

  const changePin = (newPin: string) => {
    setAuthPin(newPin);
  };

  const value: AppContextType = {
    productCategories,
    accounts,
    products,
    tanks,
    nozzles,
    masterCodes,
    shifts,
    activeShift,
    teraList,
    transactions,
    journals,
    receivables,
    payables,
    businessPartners,
    stationInfo,
    authPin,
    reports,
    addProductCategory,
    updateProductCategory,
    toggleProductCategoryStatus,
    addAccount,
    updateAccount,
    toggleAccountStatus,
    addProduct,
    updateProduct,
    toggleProductStatus,
    addTank,
    updateTank,
    toggleTankStatus,
    addNozzle,
    updateNozzle,
    toggleNozzleStatus,
    addMasterCode,
    updateMasterCode,
    toggleMasterCodeStatus,
    bukaShift,
    tutupShift,
    addTera,
    addTransaction,
    addBusinessPartner,
    updateStationInfo,
    changePin
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
