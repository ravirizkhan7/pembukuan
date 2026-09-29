/**
 * TYPE DEFINITIONS - SISTEM PEMBUKUAN & OPERASIONAL SPBU
 * Definisi tipe data terpusat untuk aplikasi tablet Android & desktop
 * Konsep: AKRUAL — Pembukuan Berbasis Kode + Tera
 */

export interface StationInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  email: string;
  status: string;
  lastBackup: string;
  version: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  status: 'Aktif' | 'Nonaktif';
}

export interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  sellPrice: number;
  buyPrice: number;
  unit: string;
  color?: string;
  status: 'Aktif' | 'Nonaktif';
  tankId?: string;
}

export interface Tank {
  id: string;
  name: string;
  productId: string;
  productName?: string;
  capacity: number;
  currentStock: number;
  unit: string;
  lastSounding: string;
  status: 'Aktif' | 'Nonaktif' | 'Aman' | 'Perlu Reorder';
}

export interface Nozzle {
  id: string;
  code: string;
  island: string;
  tankId: string;
  productId: string;
  productName?: string;
  currentMeter: number;
  status: 'Aktif' | 'Maintenance' | 'Nonaktif';
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  operator: string;
  status: 'Aktif' | 'Menunggu' | 'Tutup';
  totalSales: number;
  cashHandover: number;
  date?: string;
  initialCash?: number;
  discrepancy?: number;
}

export interface Tera {
  id: string;
  date: string;
  shiftId?: string;
  shift: string;
  nozzleId: string;
  nozzleCode: string;
  productId?: string;
  productName: string;
  price: number;
  teraAwal: number;
  teraAkhir: number;
  volume: number;
  selisih: number;
  salesAmount: number;
  officer: string;
  status: string;
  transactionId?: string;
}

export type PaymentMethod = 'Tunai' | 'Piutang' | 'Hutang' | 'Transfer';

export interface BusinessPartner {
  id: string;
  code: string;
  name: string;
  type: 'Customer' | 'Vendor';
  phone?: string;
  address?: string;
}

export interface Receivable {
  id: string;
  transactionId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  outstanding: number;
  status: 'Open' | 'Partial' | 'Paid';
  date: string;
  notes?: string;
}

export interface Payable {
  id: string;
  transactionId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  outstanding: number;
  status: 'Open' | 'Partial' | 'Paid';
  date: string;
  notes?: string;
}

export interface MasterCode {
  id: string;
  code: string; // e.g. "303", "304", "305", "306", "307", "308", "310", "312", etc.
  name: string;
  category: 'Penjualan' | 'Pembelian' | 'Biaya Operasional' | 'Persediaan' | 'Pelunasan';
  type: string;
  requiresTera: boolean;
  productId?: string;
  product?: string;
  unitPrice?: number;
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  description: string;
  paymentMethod: PaymentMethod;
  isActive: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  category: 'Aset' | 'Kewajiban' | 'Ekuitas' | 'Pendapatan' | 'Beban Pokok' | 'Beban';
  normalBalance: 'Debit' | 'Kredit';
  balance: number;
  isActive: boolean;
}

export interface JournalEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface Journal {
  id: string;
  date: string;
  transactionId?: string;
  evidenceNo?: string;
  transCode?: string;
  description: string;
  entries: JournalEntry[];
  isBalanced?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  code: string;
  name: string;
  category: string;
  productId?: string;
  product: string;
  volume: number;
  unitPrice: number;
  total: number;
  shiftId?: string;
  shift: string;
  cashier: string;
  status: string;
  nozzleId?: string;
  teraId?: string;
  teraAwal?: number;
  teraAkhir?: number;
  teraSelisih?: number;
  masterCodeId?: string;
  partnerId?: string;
  partnerName?: string;
  paymentMethod?: PaymentMethod;
  amount?: number;
  transactionId?: string;
  relatedReceivableId?: string;
  relatedPayableId?: string;
}

export interface FinancialItem {
  name: string;
  amount: number;
}

export interface StockReportItem {
  code: string;
  name: string;
  stokAwal: number;
  pembelian: number;
  penjualan: number;
  penyesuaian: number;
  stokAkhir: number;
  unit: string;
  kapasitasTanki: number;
  persenTerisi: number;
}

export interface LabaRugiRow {
  code: string;
  name: string;
  level: 1 | 2 | 3 | 4;
  saldoKemarin: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  isSectionHeader?: boolean;
}

export interface LabaRugiKonsolidasi {
  title: string;
  periodDate: string;
  entityName: string;
  location: string;
  rows: LabaRugiRow[];
}

export interface NeracaRow {
  no?: string;
  code?: string;
  name: string;
  section: 'ASET' | 'KEWAJIBAN' | 'EKUITAS' | 'TOTAL';
  level: 1 | 2 | 3 | 4;
  isContra?: boolean;
  saldoAwal: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
  isSectionHeader?: boolean;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
}

export interface NeracaKonsolidasi {
  title: string;
  periodDate: string;
  entityName: string;
  location: string;
  signerDate: string;
  rows: NeracaRow[];
}

export interface ReportsData {
  neracaKonsolidasi?: NeracaKonsolidasi;
  labaRugi: {
    period: string;
    revenues: FinancialItem[];
    cogs: FinancialItem[];
    operationalExpenses: FinancialItem[];
  };
  labaRugiKonsolidasi?: LabaRugiKonsolidasi;
  arusKas: {
    period: string;
    operasional: FinancialItem[];
    investasi: FinancialItem[];
    pendanaan: FinancialItem[];
    saldoAwal: number;
  };
  stokPenjualan: StockReportItem[];
}

export type ToastType = 'primary' | 'success' | 'danger' | 'warning';

export interface ToastMessage {
  message: string;
  type: ToastType;
}
