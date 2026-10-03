/**
 * CENTRALIZED MOCK DATA - SISTEM PEMBUKUAN & OPERASIONAL SPBU (TypeScript)
 * Konsep: AKRUAL — Pembukuan Berbasis Kode + Tera
 * Catatan: Data dummy simulasi, belum terhubung ke database.
 */

import {
  StationInfo,
  Product,
  Tank,
  Nozzle,
  Shift,
  Tera,
  MasterCode,
  Account,
  Transaction,
  Journal,
  ReportsData,
  BusinessPartner,
  Receivable,
  Payable,
  ProductCategory,
  Operator,
  Attendance
} from '../types';

export const mockStationInfo: StationInfo = {
  id: "SPBU-34-12301",
  name: "SPBU 34.12301 Pertamina",
  address: "Jl. Raya Ahmad Yani No. 88, Sidoarjo, Jawa Timur",
  phone: "(031) 8921-3400",
  manager: "H. Bambang Sudiro",
  email: "admin@spbucontoh.co.id",
  status: "Online (Simulasi Local Tablet)",
  lastBackup: "2026-09-24 18:30 WIB",
  version: "v0.1.0-alpha (AKRUAL — Prototype Berbasis Kode)"
};

// PIN AKSES DEFAULT APLIKASI (SIMULASI AUTHENTICATION TANPA IDENTITY USER)
export const initialAuthPin = "1234";

export const mockProductCategories: ProductCategory[] = [
  { id: "PCAT-001", name: "BBM Subsidi", status: "Aktif" },
  { id: "PCAT-002", name: "BBM Non-Subsidi", status: "Aktif" },
  { id: "PCAT-003", name: "Pelumas & Oli", status: "Aktif" },
  { id: "PCAT-004", name: "Non-BBM", status: "Aktif" }
];

export const mockProducts: Product[] = [
  { id: "PRD-01", code: "PLT", name: "Pertalite (RON 90)", categoryId: "PCAT-001", sellPrice: 10000, buyPrice: 9650, unit: "Liter", color: "#10B981", status: "Aktif", tankId: "TNK-01" },
  { id: "PRD-02", code: "PTX", name: "Pertamax (RON 92)", categoryId: "PCAT-002", sellPrice: 12950, buyPrice: 12400, unit: "Liter", color: "#2563EB", status: "Aktif", tankId: "TNK-02" },
  { id: "PRD-03", code: "TUR", name: "Pertamax Turbo (RON 98)", categoryId: "PCAT-002", sellPrice: 14400, buyPrice: 13800, unit: "Liter", color: "#DC2626", status: "Aktif", tankId: "TNK-03" },
  { id: "PRD-04", code: "BSL", name: "Bio Solar", categoryId: "PCAT-001", sellPrice: 6800, buyPrice: 6550, unit: "Liter", color: "#D97706", status: "Aktif", tankId: "TNK-04" },
  { id: "PRD-05", code: "DXL", name: "Dexlite", categoryId: "PCAT-002", sellPrice: 13700, buyPrice: 13150, unit: "Liter", color: "#059669", status: "Aktif", tankId: "TNK-05" },
  // Produk Oli & Pelumas (Non-Tanki, Unit: Botol)
  { id: "PRD-06", code: "OLI-001", name: "Pertamina Enduro 4T 10W-40", categoryId: "PCAT-003", sellPrice: 48000, buyPrice: 42000, unit: "Botol", color: "#EF4444", status: "Aktif" },
  { id: "PRD-07", code: "OLI-002", name: "Pertamina Enduro Matic 10W-30", categoryId: "PCAT-003", sellPrice: 50000, buyPrice: 44000, unit: "Botol", color: "#3B82F6", status: "Aktif" },
  { id: "PRD-08", code: "OLI-003", name: "Federal Matic 30", categoryId: "PCAT-003", sellPrice: 46000, buyPrice: 40000, unit: "Botol", color: "#F59E0B", status: "Aktif" },
  { id: "PRD-09", code: "OLI-004", name: "Castrol Activ 4T", categoryId: "PCAT-003", sellPrice: 55000, buyPrice: 48000, unit: "Botol", color: "#10B981", status: "Aktif" },
  { id: "PRD-10", code: "OLI-005", name: "Shell Advance AX5", categoryId: "PCAT-003", sellPrice: 52000, buyPrice: 45500, unit: "Botol", color: "#E11D48", status: "Aktif" }
];

export const mockTanks: Tank[] = [
  { id: "TNK-01", name: "Tanki Pendam 1", productId: "PRD-01", productName: "Pertalite", capacity: 30000, currentStock: 21450, unit: "Liter", lastSounding: "2026-09-24 05:45", status: "Aman" },
  { id: "TNK-02", name: "Tanki Pendam 2", productId: "PRD-02", productName: "Pertamax", capacity: 20000, currentStock: 14200, unit: "Liter", lastSounding: "2026-09-24 05:50", status: "Aman" },
  { id: "TNK-03", name: "Tanki Pendam 3", productId: "PRD-03", productName: "Pertamax Turbo", capacity: 15000, currentStock: 4800, unit: "Liter", lastSounding: "2026-09-24 05:52", status: "Perlu Reorder" },
  { id: "TNK-04", name: "Tanki Pendam 4", productId: "PRD-04", productName: "Bio Solar", capacity: 30000, currentStock: 25800, unit: "Liter", lastSounding: "2026-09-24 05:55", status: "Aman" },
  { id: "TNK-05", name: "Tanki Pendam 5", productId: "PRD-05", productName: "Dexlite", capacity: 15000, currentStock: 11200, unit: "Liter", lastSounding: "2026-09-24 05:58", status: "Aman" }
];

export const mockNozzles: Nozzle[] = [
  { id: "NZL-01", code: "NZ-01", island: "Pulau 1 (Mobil)", tankId: "TNK-01", productId: "PRD-01", productName: "Pertalite", currentMeter: 485230.5, status: "Aktif" },
  { id: "NZL-02", code: "NZ-02", island: "Pulau 1 (Mobil)", tankId: "TNK-02", productId: "PRD-02", productName: "Pertamax", currentMeter: 312110.2, status: "Aktif" },
  { id: "NZL-03", code: "NZ-03", island: "Pulau 2 (Mobil)", tankId: "TNK-04", productId: "PRD-04", productName: "Bio Solar", currentMeter: 592880.0, status: "Aktif" },
  { id: "NZL-04", code: "NZ-04", island: "Pulau 2 (Mobil)", tankId: "TNK-05", productId: "PRD-05", productName: "Dexlite", currentMeter: 184520.8, status: "Aktif" },
  { id: "NZL-05", code: "NZ-05", island: "Pulau 3 (Motor)", tankId: "TNK-01", productId: "PRD-01", productName: "Pertalite", currentMeter: 820140.3, status: "Aktif" },
  { id: "NZL-06", code: "NZ-06", island: "Pulau 3 (Motor)", tankId: "TNK-02", productId: "PRD-02", productName: "Pertamax", currentMeter: 440215.7, status: "Aktif" },
  { id: "NZL-07", code: "NZ-07", island: "Pulau 4 (Motor)", tankId: "TNK-01", productId: "PRD-01", productName: "Pertalite", currentMeter: 765910.1, status: "Maintenance" },
  { id: "NZL-08", code: "NZ-08", island: "Pulau 4 (Motor)", tankId: "TNK-03", productId: "PRD-03", productName: "Pertamax Turbo", currentMeter: 125300.4, status: "Aktif" }
];

export const mockShifts: Shift[] = [
  { id: "SFT-01", name: "Shift 1", startTime: "07:00", endTime: "15:00", operator: "Ahmad Fauzi", status: "Aktif", totalSales: 28450000, cashHandover: 0, date: "2026-09-24", initialCash: 1000000, discrepancy: 0 },
  { id: "SFT-02", name: "Shift 2", startTime: "15:00", endTime: "23:00", operator: "Siti Rahma", status: "Menunggu", totalSales: 0, cashHandover: 0, date: "2026-09-24", initialCash: 0, discrepancy: 0 }
];

export const mockOperators: Operator[] = [
  { id: "OPR-01", name: "Ahmad Fauzi", role: "Operator Kasir", status: "Aktif" },
  { id: "OPR-02", name: "Siti Rahma", role: "Operator Kasir", status: "Aktif" },
  { id: "OPR-03", name: "Doni Pratama", role: "Operator Kasir", status: "Aktif" },
  { id: "OPR-04", name: "Rima", role: "Operator Kasir", status: "Aktif" }
];

export const mockAttendances: Attendance[] = [
  {
    id: "ATT-20260924-001",
    operatorId: "OPR-01",
    operatorName: "Ahmad Fauzi",
    shiftId: "SFT-01",
    shiftName: "Shift 1",
    date: "2026-09-24",
    status: "Hadir",
    notes: "Tepat waktu",
    checkInTime: "06:55"
  },
  {
    id: "ATT-20260924-002",
    operatorId: "OPR-04",
    operatorName: "Rima",
    shiftId: "SFT-01",
    shiftName: "Shift 1",
    date: "2026-09-24",
    status: "Hadir",
    notes: "Tepat waktu",
    checkInTime: "06:58"
  },
  {
    id: "ATT-20260924-003",
    operatorId: "OPR-02",
    operatorName: "Siti Rahma",
    shiftId: "SFT-02",
    shiftName: "Shift 2",
    date: "2026-09-24",
    status: "Hadir",
    notes: "Shift siang standby",
    checkInTime: "14:50"
  },
  {
    id: "ATT-20260924-004",
    operatorId: "OPR-03",
    operatorName: "Doni Pratama",
    shiftId: "SFT-02",
    shiftName: "Shift 2",
    date: "2026-09-24",
    status: "Izin",
    notes: "Izin urusan keluarga",
    checkInTime: "-"
  }
];

/**
 * Requirement Tera:
 * Volume = Tera Akhir - Tera Awal
 * Nilai Penjualan = Volume * Harga Jual
 */
export const mockTera: Tera[] = [
  {
    id: "TRA-001",
    date: "2026-09-24",
    shiftId: "SFT-01",
    shift: "Shift 1",
    nozzleId: "NZL-01",
    nozzleCode: "NZ-01",
    productId: "PRD-01",
    productName: "Pertalite",
    price: 10000,
    teraAwal: 483500.0,
    teraAkhir: 485230.5,
    volume: 1730.5,
    selisih: 0.0,
    salesAmount: 17305000,
    officer: "Ahmad Fauzi",
    status: "Valid",
    transactionId: "TX-20260924-001"
  },
  {
    id: "TRA-002",
    date: "2026-09-24",
    shiftId: "SFT-01",
    shift: "Shift 1",
    nozzleId: "NZL-02",
    nozzleCode: "NZ-02",
    productId: "PRD-02",
    productName: "Pertamax",
    price: 12950,
    teraAwal: 311450.0,
    teraAkhir: 312110.2,
    volume: 660.2,
    selisih: 0.0,
    salesAmount: 8549590,
    officer: "Ahmad Fauzi",
    status: "Valid",
    transactionId: "TX-20260924-002"
  },
  {
    id: "TRA-003",
    date: "2026-09-24",
    shiftId: "SFT-01",
    shift: "Shift 1",
    nozzleId: "NZL-03",
    nozzleCode: "NZ-03",
    productId: "PRD-04",
    productName: "Bio Solar",
    price: 6800,
    teraAwal: 591900.0,
    teraAkhir: 592880.0,
    volume: 980.0,
    selisih: 0.0,
    salesAmount: 6664000,
    officer: "Ahmad Fauzi",
    status: "Valid"
  }
];

/**
 * Master Code Berbasis Prototype:
 * Menggunakan kode numerik ringkas (303, 304, 305, 306, 307, 308, 309).
 * Master Code DINAMIS, menentukan template input dan mapping akuntansi.
 */
export const mockMasterCodes: MasterCode[] = [
  {
    id: "MK-303",
    code: "303",
    name: "Penjualan Pertalite Tunai",
    category: "Penjualan",
    type: "Penjualan BBM",
    requiresTera: true,
    productId: "PRD-01",
    product: "Pertalite",
    unitPrice: 10000,
    debitAccountId: "1-1001",
    debitAccountName: "Kas Utama",
    creditAccountId: "4-1001",
    creditAccountName: "Pendapatan Penjualan Pertalite",
    description: "Penjualan Pertalite tunai dengan pengukuran Tera Nozzle",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-304",
    code: "304",
    name: "Penjualan Pertamax Tunai",
    category: "Penjualan",
    type: "Penjualan BBM",
    requiresTera: true,
    productId: "PRD-02",
    product: "Pertamax",
    unitPrice: 12950,
    debitAccountId: "1-1001",
    debitAccountName: "Kas Utama",
    creditAccountId: "4-1002",
    creditAccountName: "Pendapatan Penjualan Pertamax",
    description: "Penjualan Pertamax tunai dengan pengukuran Tera Nozzle",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-309",
    code: "309",
    name: "Penjualan Bio Solar Tunai",
    category: "Penjualan",
    type: "Penjualan BBM",
    requiresTera: true,
    productId: "PRD-04",
    product: "Bio Solar",
    unitPrice: 6800,
    debitAccountId: "1-1001",
    debitAccountName: "Kas Utama",
    creditAccountId: "4-1003",
    creditAccountName: "Pendapatan Penjualan Bio Solar",
    description: "Penjualan Bio Solar tunai dengan pengukuran Tera Nozzle",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-310",
    code: "310",
    name: "Penjualan Pertalite Kredit (Piutang)",
    category: "Penjualan",
    type: "Penjualan BBM",
    requiresTera: true,
    productId: "PRD-01",
    product: "Pertalite",
    unitPrice: 10000,
    debitAccountId: "1-1101",
    debitAccountName: "Piutang Usaha",
    creditAccountId: "4-1001",
    creditAccountName: "Pendapatan Penjualan Pertalite",
    description: "Penjualan Pertalite non-tunai kupon/tagihan instansi langganan",
    paymentMethod: "Piutang",
    isActive: true
  },
  {
    id: "MK-311",
    code: "311",
    name: "Penjualan Pertamax Kredit (Piutang)",
    category: "Penjualan",
    type: "Penjualan BBM",
    requiresTera: true,
    productId: "PRD-02",
    product: "Pertamax",
    unitPrice: 12950,
    debitAccountId: "1-1101",
    debitAccountName: "Piutang Usaha",
    creditAccountId: "4-1002",
    creditAccountName: "Pendapatan Penjualan Pertamax",
    description: "Penjualan Pertamax non-tunai kupon/tagihan instansi langganan",
    paymentMethod: "Piutang",
    isActive: true
  },
  {
    id: "MK-312",
    code: "312",
    name: "Pelunasan Piutang Pelanggan",
    category: "Pelunasan",
    type: "Penerimaan Kas",
    requiresTera: false,
    debitAccountId: "1-1001",
    debitAccountName: "Kas Utama",
    creditAccountId: "1-1101",
    creditAccountName: "Piutang Usaha",
    description: "Penerimaan setoran kas dari penagihan piutang kupon langganan",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-305",
    code: "305",
    name: "Biaya Listrik PLN & Genset",
    category: "Biaya Operasional",
    type: "Beban Operasional",
    requiresTera: false,
    debitAccountId: "6-1002",
    debitAccountName: "Biaya Listrik & Air",
    creditAccountId: "1-1001",
    creditAccountName: "Kas Utama",
    description: "Pembayaran tagihan listrik PLN dan BBM genset SPBU",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-306",
    code: "306",
    name: "Biaya Langganan WiFi & Telp",
    category: "Biaya Operasional",
    type: "Beban Operasional",
    requiresTera: false,
    debitAccountId: "6-1002",
    debitAccountName: "Biaya Listrik & Air",
    creditAccountId: "1-1001",
    creditAccountName: "Kas Utama",
    description: "Pembayaran internet fiber optik operasional kantor SPBU",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-307",
    code: "307",
    name: "Gaji & Uang Makan Karyawan",
    category: "Biaya Operasional",
    type: "Beban Operasional",
    requiresTera: false,
    debitAccountId: "6-1001",
    debitAccountName: "Biaya Gaji & Upah Karyawan",
    creditAccountId: "1-1001",
    creditAccountName: "Kas Utama",
    description: "Upah kerja operator shift, teknisi, dan petugas kebersihan",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-308",
    code: "308",
    name: "Penebusan DO Pertamina (Pertalite)",
    category: "Pembelian",
    type: "Pembelian BBM",
    requiresTera: false,
    productId: "PRD-01",
    product: "Pertalite",
    unitPrice: 9650,
    debitAccountId: "1-1201",
    debitAccountName: "Persediaan BBM Pertalite",
    creditAccountId: "1-1002",
    creditAccountName: "Bank Mandiri Operasional",
    description: "Penebusan Delivery Order BBM ke Pertamina Patra Niaga (Bank)",
    paymentMethod: "Transfer",
    isActive: true
  },
  {
    id: "MK-313",
    code: "313",
    name: "Pembelian Persediaan Tunai Kas",
    category: "Pembelian",
    type: "Pembelian BBM / Barang",
    requiresTera: false,
    productId: "PRD-01",
    product: "Pertalite",
    unitPrice: 9650,
    debitAccountId: "1-1201",
    debitAccountName: "Persediaan BBM Pertalite",
    creditAccountId: "1-1001",
    creditAccountName: "Kas Utama",
    description: "Pembelian BBM atau perlengkapan operasional langsung tunai kas brankas",
    paymentMethod: "Tunai",
    isActive: true
  },
  {
    id: "MK-314",
    code: "314",
    name: "Pembelian Persediaan Kredit (Hutang Usaha)",
    category: "Pembelian",
    type: "Pembelian BBM / Barang",
    requiresTera: false,
    productId: "PRD-01",
    product: "Pertalite",
    unitPrice: 9650,
    debitAccountId: "1-1201",
    debitAccountName: "Persediaan BBM Pertalite",
    creditAccountId: "2-1001",
    creditAccountName: "Hutang Usaha (Pertamina)",
    description: "Penerimaan DO / barang dagang secara kredit atau konsinyasi",
    paymentMethod: "Hutang",
    isActive: true
  },
  {
    id: "MK-315",
    code: "315",
    name: "Pembayaran Hutang Usaha",
    category: "Pelunasan",
    type: "Pengeluaran Kas",
    requiresTera: false,
    debitAccountId: "2-1001",
    debitAccountName: "Hutang Usaha (Pertamina)",
    creditAccountId: "1-1001",
    creditAccountName: "Kas Utama",
    description: "Pembayaran pelunasan invoice tagihan hutang supplier/vendor",
    paymentMethod: "Tunai",
    isActive: true
  }
];

export const mockAccounts: Account[] = [
  { id: "1-1001", code: "1-1001", name: "Kas Utama (Brankas)", category: "Aset", normalBalance: "Debit", balance: 54820000, isActive: true },
  { id: "1-1002", code: "1-1002", name: "Bank Mandiri Operasional", category: "Aset", normalBalance: "Debit", balance: 185400000, isActive: true },
  { id: "1-1101", code: "1-1101", name: "Piutang Usaha (Pelanggan / Kupon)", category: "Aset", normalBalance: "Debit", balance: 15000000, isActive: true },
  { id: "1-1201", code: "1-1201", name: "Persediaan BBM Pertalite", category: "Aset", normalBalance: "Debit", balance: 206992500, isActive: true },
  { id: "1-1202", code: "1-1202", name: "Persediaan BBM Pertamax", category: "Aset", normalBalance: "Debit", balance: 176080000, isActive: true },
  { id: "1-1203", code: "1-1203", name: "Persediaan BBM Bio Solar", category: "Aset", normalBalance: "Debit", balance: 168990000, isActive: true },
  { id: "1-1204", code: "1-1204", name: "Persediaan BBM Dexlite", category: "Aset", normalBalance: "Debit", balance: 147280000, isActive: true },
  { id: "1-1501", code: "1-1501", name: "Tanah & Bangunan SPBU", category: "Aset", normalBalance: "Debit", balance: 1850000000, isActive: true },
  { id: "1-1502", code: "1-1502", name: "Dispenser & Mesin Pompa", category: "Aset", normalBalance: "Debit", balance: 420000000, isActive: true },
  { id: "2-1001", code: "2-1001", name: "Hutang Usaha (Pertamina)", category: "Kewajiban", normalBalance: "Kredit", balance: 95000000, isActive: true },
  { id: "2-1002", code: "2-1002", name: "Hutang Beban Operasional", category: "Kewajiban", normalBalance: "Kredit", balance: 6500000, isActive: true },
  { id: "3-1001", code: "3-1001", name: "Modal Pemilik SPBU", category: "Ekuitas", normalBalance: "Kredit", balance: 2850000000, isActive: true },
  { id: "3-2001", code: "3-2001", name: "Laba Ditahan", category: "Ekuitas", normalBalance: "Kredit", balance: 185000000, isActive: true },
  { id: "4-1001", code: "4-1001", name: "Pendapatan Penjualan Pertalite", category: "Pendapatan", normalBalance: "Kredit", balance: 74200000, isActive: true },
  { id: "4-1002", code: "4-1002", name: "Pendapatan Penjualan Pertamax", category: "Pendapatan", normalBalance: "Kredit", balance: 41850000, isActive: true },
  { id: "4-1003", code: "4-1003", name: "Pendapatan Penjualan Bio Solar", category: "Pendapatan", normalBalance: "Kredit", balance: 32600000, isActive: true },
  { id: "5-1001", code: "5-1001", name: "HPP Pertalite", category: "Beban Pokok", normalBalance: "Debit", balance: 71600000, isActive: true },
  { id: "6-1001", code: "6-1001", name: "Biaya Gaji & Upah Karyawan", category: "Beban", normalBalance: "Debit", balance: 12500000, isActive: true },
  { id: "6-1002", code: "6-1002", name: "Biaya Listrik & Air", category: "Beban", normalBalance: "Debit", balance: 4200000, isActive: true },
  { id: "6-1003", code: "6-1003", name: "Biaya Pemeliharaan & Tera", category: "Beban", normalBalance: "Debit", balance: 2100000, isActive: true }
];

export const mockTransactions: Transaction[] = [
  {
    id: "TX-20260924-001",
    date: "2026-09-24 07:15",
    code: "303",
    name: "Penjualan Pertalite Tunai",
    category: "Penjualan BBM",
    productId: "PRD-01",
    product: "Pertalite",
    volume: 35.5,
    unitPrice: 10000,
    total: 355000,
    shiftId: "SFT-01",
    shift: "Shift 1",
    cashier: "Ahmad Fauzi",
    status: "Selesai",
    nozzleId: "NZL-01",
    teraId: "TRA-001",
    teraAwal: 485195.0,
    teraAkhir: 485230.5
  },
  {
    id: "TX-20260924-002",
    date: "2026-09-24 07:22",
    code: "304",
    name: "Penjualan Pertamax Tunai",
    category: "Penjualan BBM",
    productId: "PRD-02",
    product: "Pertamax",
    volume: 25.0,
    unitPrice: 12950,
    total: 323750,
    shiftId: "SFT-01",
    shift: "Shift 1",
    cashier: "Ahmad Fauzi",
    status: "Selesai",
    nozzleId: "NZL-02",
    teraId: "TRA-002",
    teraAwal: 312085.2,
    teraAkhir: 312110.2
  },
  {
    id: "TX-20260924-003",
    date: "2026-09-24 08:30",
    code: "308",
    name: "Penebusan DO Pertamina (Pertalite)",
    category: "Pembelian",
    productId: "PRD-01",
    product: "Pertalite",
    volume: 16000,
    unitPrice: 9650,
    total: 154400000,
    shiftId: "SFT-01",
    shift: "Shift 1",
    cashier: "Ahmad Fauzi",
    status: "Selesai"
  },
  {
    id: "TX-20260924-004",
    date: "2026-09-24 09:10",
    code: "305",
    name: "Biaya Listrik PLN & Genset",
    category: "Biaya Operasional",
    product: "-",
    volume: 0,
    unitPrice: 0,
    total: 3850000,
    shiftId: "SFT-01",
    shift: "Shift 1",
    cashier: "Ahmad Fauzi",
    status: "Selesai"
  },
  {
    id: "TX-20260924-005",
    date: "2026-09-24 10:45",
    code: "309",
    name: "Penjualan Bio Solar Tunai",
    category: "Penjualan BBM",
    productId: "PRD-04",
    product: "Bio Solar",
    volume: 60.0,
    unitPrice: 6800,
    total: 408000,
    shiftId: "SFT-01",
    shift: "Shift 1",
    cashier: "Ahmad Fauzi",
    status: "Selesai",
    nozzleId: "NZL-03",
    teraId: "TRA-003",
    teraAwal: 592820.0,
    teraAkhir: 592880.0
  }
];

export const mockBusinessPartners: BusinessPartner[] = [
  { id: "CUS-001", code: "CUS-001", name: "PT Transport Logistik Andalas", type: "Customer", phone: "0812-3456-7890", address: "Jl. By Pass No. 12, Padang" },
  { id: "CUS-002", code: "CUS-002", name: "Koperasi Angkutan Minang Mandiri", type: "Customer", phone: "0813-9876-5432", address: "Jl. Raya Lubuk Alung No. 45" },
  { id: "CUS-003", code: "CUS-003", name: "Dinas Lingkungan Hidup Kab. Padang Pariaman", type: "Customer", phone: "0751-89100", address: "Kompleks Pemkab Padang Pariaman" },
  { id: "VEN-001", code: "VEN-001", name: "PT Pertamina Patra Niaga", type: "Vendor", phone: "135", address: "Jl. Veteran No. 1, Jakarta" },
  { id: "VEN-002", code: "VEN-002", name: "PT PLN (Persero) ULP Lubuk Alung", type: "Vendor", phone: "123", address: "Jl. Syekh Burhanuddin, Lubuk Alung" }
];

export const mockReceivables: Receivable[] = [
  {
    id: "REC-001",
    transactionId: "TX-INIT-001",
    partnerId: "CUS-001",
    partnerName: "PT Transport Logistik Andalas",
    amount: 15000000,
    outstanding: 15000000,
    status: "Open",
    date: "2026-09-20",
    notes: "Pengisian Armada BBM Solar (Kupon #4421-4435)"
  }
];

export const mockPayables: Payable[] = [
  {
    id: "PAY-001",
    transactionId: "TX-INIT-002",
    partnerId: "VEN-001",
    partnerName: "PT Pertamina Patra Niaga",
    amount: 95000000,
    outstanding: 95000000,
    status: "Open",
    date: "2026-09-18",
    notes: "DO Konsinyasi BBM Pertalite 10.000 L"
  }
];

export const mockJournal: Journal[] = [
  {
    id: "JRN-001",
    date: "2026-09-24",
    evidenceNo: "BKT/20260924/001",
    transCode: "303",
    description: "Penjualan Pertalite Tunai Shift 1",
    isBalanced: true,
    entries: [
      { accountId: "1-1001", accountCode: "1-1001", accountName: "Kas Utama", debit: 355000, credit: 0 },
      { accountId: "4-1001", accountCode: "4-1001", accountName: "Pendapatan Penjualan Pertalite", debit: 0, credit: 355000 }
    ]
  },
  {
    id: "JRN-002",
    date: "2026-09-24",
    evidenceNo: "BKT/20260924/002",
    transCode: "304",
    description: "Penjualan Pertamax Tunai Shift 1",
    isBalanced: true,
    entries: [
      { accountId: "1-1001", accountCode: "1-1001", accountName: "Kas Utama", debit: 323750, credit: 0 },
      { accountId: "4-1002", accountCode: "4-1002", accountName: "Pendapatan Penjualan Pertamax", debit: 0, credit: 323750 }
    ]
  },
  {
    id: "JRN-003",
    date: "2026-09-24",
    evidenceNo: "DO/PTM/2026/09/881",
    transCode: "308",
    description: "Penebusan DO Pertamina Pertalite 16.000 L",
    isBalanced: true,
    entries: [
      { accountId: "1-1201", accountCode: "1-1201", accountName: "Persediaan BBM Pertalite", debit: 154400000, credit: 0 },
      { accountId: "1-1002", accountCode: "1-1002", accountName: "Bank Mandiri Operasional", debit: 0, credit: 154400000 }
    ]
  },
  {
    id: "JRN-004",
    date: "2026-09-24",
    evidenceNo: "PLN/BKT/0924",
    transCode: "305",
    description: "Pembayaran Listrik & Token Genset SPBU",
    isBalanced: true,
    entries: [
      { accountId: "6-1002", accountCode: "6-1002", accountName: "Biaya Listrik & Air", debit: 3850000, credit: 0 },
      { accountId: "1-1001", accountCode: "1-1001", accountName: "Kas Utama", debit: 0, credit: 3850000 }
    ]
  }
];

export const mockReports: ReportsData = {
  neracaKonsolidasi: {
    title: "LAPORAN NERACA HARIAN KONSOLIDASI",
    periodDate: "31-Aug-2026",
    entityName: "PT BPR Ganto Nagari 1954",
    location: "Lubuk alung",
    signerDate: "01/09/26",
    rows: [
      // === 1. ASET ===
      {
        no: "",
        code: "",
        name: "1. ASET",
        section: "ASET",
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "1",
        code: "100",
        name: "Kas dalam Rupiah",
        section: "ASET",
        level: 2,
        saldoAwal: 270490000,
        debet: 322361003,
        kredit: 410931503,
        saldoAkhir: 181919500
      },
      {
        no: "-",
        code: "101",
        name: "Kas Kecil",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "2",
        code: "102",
        name: "Kas Dalam Valuta Asing",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "3",
        code: "110",
        name: "Surat Berharga",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "4",
        code: "130",
        name: "Penempatan Pada Bank Lain",
        section: "ASET",
        level: 2,
        saldoAwal: 12247151526,
        debet: 333226100,
        kredit: 108815296,
        saldoAkhir: 12471562330
      },
      {
        no: "-",
        code: "131",
        name: "-/- Cadangan Penurunan Nilai",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: -6195412,
        debet: 5773040,
        kredit: 0,
        saldoAkhir: -422372
      },
      {
        no: "5",
        code: "140",
        name: "Kredit Yang Diberikan (Baki debet)",
        section: "ASET",
        level: 2,
        saldoAwal: 28324827270,
        debet: 125438621,
        kredit: 265557380,
        saldoAkhir: 28184708511
      },
      {
        no: "-",
        code: "141",
        name: "-/- Provisi yang belum diamortisasi",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: -230510535,
        debet: 7530924,
        kredit: 800000,
        saldoAkhir: -223779611
      },
      {
        no: "-",
        code: "142",
        name: "Biaya Transaksi yang belum diamortisasi",
        section: "ASET",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "143",
        name: "-/- Pendapatan Bunga yang Ditangguhkan dalam rangka Restrukturisasi",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "144",
        name: "-/- Cadangan Kerugian Restrukturisasi",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "145",
        name: "-/- Cadangan Penurunan Nilai",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: -1195982033,
        debet: 0,
        kredit: 11392147,
        saldoAkhir: -1207374180
      },
      {
        no: "6",
        code: "200",
        name: "Agunan Yang Diambil Alih",
        section: "ASET",
        level: 2,
        saldoAwal: 61977337,
        debet: 0,
        kredit: 0,
        saldoAkhir: 61977337
      },
      {
        no: "7",
        code: "201",
        name: "Properti Terbengkalai",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "8",
        code: "210",
        name: "Aset Tetap dan Inventaris",
        section: "ASET",
        level: 2,
        saldoAwal: 3318045868,
        debet: 0,
        kredit: 0,
        saldoAkhir: 3318045868
      },
      {
        no: "-",
        code: "211",
        name: "-/- Akumulasi Penyusutan dan Penurunan Nilai",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: -1321785322,
        debet: 0,
        kredit: 0,
        saldoAkhir: -1321785322
      },
      {
        no: "9",
        code: "220",
        name: "Aset Tak Berwujud",
        section: "ASET",
        level: 2,
        saldoAwal: 8500000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 8500000
      },
      {
        no: "-",
        code: "221",
        name: "-/- Akumulasi Penyusutan dan Penurunan Nilai",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: -7020838,
        debet: 0,
        kredit: 0,
        saldoAkhir: -7020838
      },
      {
        no: "10",
        code: "230",
        name: "Aset Antar Kantor",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "11",
        code: "240",
        name: "Aset Keuangan Lainnya",
        section: "ASET",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "250",
        name: "-/- Cadangan Penurunan Nilai",
        section: "ASET",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "12",
        code: "270",
        name: "Aset Lain-lain",
        section: "ASET",
        level: 2,
        saldoAwal: 428355252,
        debet: 236249960,
        kredit: 75023509,
        saldoAkhir: 589581703
      },
      {
        no: "-",
        code: "-",
        name: "TOTAL ASET",
        section: "ASET",
        level: 1,
        isSubtotal: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "",
        code: "",
        name: "Sub Total 1. ASET",
        section: "ASET",
        level: 1,
        isSubtotal: true,
        saldoAwal: 41897853113,
        debet: 1030579648,
        kredit: 872519835,
        saldoAkhir: 42055912926
      },
      {
        no: "",
        code: "",
        name: "Jumlah Aset",
        section: "ASET",
        level: 1,
        isGrandTotal: true,
        saldoAwal: 41897853113,
        debet: 1030579648,
        kredit: 872519835,
        saldoAkhir: 42055912926
      },

      // === 2. KEWAJIBAN ===
      {
        no: "",
        code: "",
        name: "2. KEWAJIBAN",
        section: "KEWAJIBAN",
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "1",
        code: "300",
        name: "Liabilitas Segera",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 161341160,
        debet: 0,
        kredit: 3560826,
        saldoAkhir: 164901986
      },
      {
        no: "-",
        code: "-",
        name: "Simpanan",
        section: "KEWAJIBAN",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "2",
        code: "330",
        name: "a. Tabungan",
        section: "KEWAJIBAN",
        level: 3,
        saldoAwal: 12115095068,
        debet: 451478872,
        kredit: 196992756,
        saldoAkhir: 11860608952
      },
      {
        no: "-",
        code: "331",
        name: "-/- Biaya Transaksi Belum Diamortisasi",
        section: "KEWAJIBAN",
        level: 4,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "3",
        code: "340",
        name: "b. Deposito",
        section: "KEWAJIBAN",
        level: 3,
        saldoAwal: 20785000000,
        debet: 80000000,
        kredit: 0,
        saldoAkhir: 20705000000
      },
      {
        no: "-",
        code: "341",
        name: "-/- Biaya Transaksi Belum Diamortisasi",
        section: "KEWAJIBAN",
        level: 4,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "4",
        code: "360",
        name: "Simpanan Dari Bank Lain",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 972284420,
        debet: 20000000,
        kredit: 283787195,
        saldoAkhir: 1236071615
      },
      {
        no: "-",
        code: "361",
        name: "-/- Biaya Transaksi Belum Diamortisasi",
        section: "KEWAJIBAN",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "5",
        code: "370",
        name: "Pinjaman Diterima",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "371",
        name: "-/- Biaya Transaksi Belum Diamortisasi",
        section: "KEWAJIBAN",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "372",
        name: "-/- Diskonto Belum Diamortisasi",
        section: "KEWAJIBAN",
        level: 3,
        isContra: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "7",
        code: "400",
        name: "Dana Setoran Modal - Kewajiban",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "8",
        code: "440",
        name: "Liabilitas Antar Kantor",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "9",
        code: "470",
        name: "Liabilitas Lainnya",
        section: "KEWAJIBAN",
        level: 2,
        saldoAwal: 62597088,
        debet: 610411,
        kredit: 49016878,
        saldoAkhir: 111003555
      },
      {
        no: "-",
        code: "-",
        name: "TOTAL LIABILITAS",
        section: "KEWAJIBAN",
        level: 1,
        isSubtotal: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "",
        code: "",
        name: "Sub Total 2. KEWAJIBAN",
        section: "KEWAJIBAN",
        level: 1,
        isSubtotal: true,
        saldoAwal: 34096317736,
        debet: 552089283,
        kredit: 533357655,
        saldoAkhir: 34077586108
      },

      // === 3. EKUITAS ===
      {
        no: "",
        code: "",
        name: "3. EKUITAS",
        section: "EKUITAS",
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "10",
        code: "-",
        name: "1. Modal Disetor",
        section: "EKUITAS",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "501",
        name: "a. Modal Dasar",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 10000000000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 10000000000
      },
      {
        no: "-",
        code: "502",
        name: "b. Modal Yang Belum Disetor -/-",
        section: "EKUITAS",
        level: 3,
        isContra: true,
        saldoAwal: -3935650000,
        debet: 0,
        kredit: 0,
        saldoAkhir: -3935650000
      },
      {
        no: "11",
        code: "-",
        name: "2. Tambahan Modal Disetor",
        section: "EKUITAS",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "503",
        name: "a. Agio/Disagio",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "504",
        name: "b. Modal Sumbangan",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "505",
        name: "c. Dana Setoran Modal - Ekuitas",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 1000000000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 1000000000
      },
      {
        no: "-",
        code: "506",
        name: "d. Tambahan Modal Disetor Lainnya",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "12",
        code: "-",
        name: "3. Ekuitas Lainnya",
        section: "EKUITAS",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "510",
        name: "a. Keuntungan (Kerugian) dari Perubahan Nilai Aset Keuangan",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "511",
        name: "b. Keuntungan Revaluasi Aset Tetap",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 1150330208,
        debet: 0,
        kredit: 0,
        saldoAkhir: 1150330208
      },
      {
        no: "-",
        code: "512",
        name: "c. Lainnya",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "513",
        name: "d. Pajak Penghasilan terkait dengan Ekuitas Lain",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "13",
        code: "-",
        name: "Cadangan",
        section: "EKUITAS",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "541",
        name: "a. Cadangan Umum",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 739566478,
        debet: 0,
        kredit: 0,
        saldoAkhir: 739566478
      },
      {
        no: "-",
        code: "542",
        name: "b. Cadangan Tujuan",
        section: "EKUITAS",
        level: 3,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "14",
        code: "-",
        name: "Laba/Rugi",
        section: "EKUITAS",
        level: 2,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "-",
        code: "543",
        name: "a. Tahun-Tahun Lalu",
        section: "EKUITAS",
        level: 3,
        isContra: true,
        saldoAwal: -897720652,
        debet: 0,
        kredit: 0,
        saldoAkhir: -897720652
      },
      {
        no: "-",
        code: "545",
        name: "b. Laba Rugi Tahun Berjalan",
        section: "EKUITAS",
        level: 3,
        isContra: true,
        saldoAwal: -254990657,
        debet: 169761683,
        kredit: 346553124,
        saldoAkhir: -78199216
      },
      {
        no: "-",
        code: "-",
        name: "TOTAL EKUITAS",
        section: "EKUITAS",
        level: 1,
        isSubtotal: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        no: "",
        code: "",
        name: "Sub Total 3. EKUITAS",
        section: "EKUITAS",
        level: 1,
        isSubtotal: true,
        saldoAwal: 7801535377,
        debet: 169761683,
        kredit: 346553124,
        saldoAkhir: 7978326818
      },

      // === GRAND TOTAL ===
      {
        no: "",
        code: "",
        name: "Jumlah Kewajiban + Ekuitas",
        section: "TOTAL",
        level: 1,
        isGrandTotal: true,
        saldoAwal: 41897853113,
        debet: 721850966,
        kredit: 879910779,
        saldoAkhir: 42055912926
      }
    ]
  },
  labaRugi: {
    period: "Agustus 2026",
    revenues: [
      { name: "Penjualan Pertalite", amount: 245800000 },
      { name: "Penjualan Pertamax", amount: 154200000 },
      { name: "Penjualan Bio Solar", amount: 98400000 },
      { name: "Penjualan Dexlite", amount: 46800000 }
    ],
    cogs: [
      { name: "HPP Pertalite (Pembelian Netto)", amount: 237200000 },
      { name: "HPP Pertamax", amount: 147600000 },
      { name: "HPP Bio Solar", amount: 94800000 },
      { name: "HPP Dexlite", amount: 44900000 }
    ],
    operationalExpenses: [
      { name: "Gaji & Upah Karyawan Shift", amount: 18500000 },
      { name: "Biaya Listrik PLN & Bahan Bakar Genset", amount: 7200000 },
      { name: "Biaya Retribusi & Tera Dispenser", amount: 3500000 },
      { name: "Biaya Perlengkapan Kasir & Kantor", amount: 1800000 }
    ]
  },
  labaRugiKonsolidasi: {
    title: "LAPORAN LABA-RUGI KONSOLIDASI HARIAN",
    periodDate: "31 Agustus 2026",
    entityName: "PT SPBU Mitra Akrual 1954",
    location: "Lubuk alung",
    rows: [
      // === A. PENDAPATAN OPERASIONAL ===
      {
        code: "100",
        name: "A. Pendapatan Operasional",
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "-",
        name: "1. Pendapatan Penjualan BBM",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "-",
        name: "a. Penjualan BBM Retail Bersubsidi & Kompensasi",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "111",
        name: "i.  Pertalite RON 90 (Kompensasi)",
        level: 4,
        saldoKemarin: 38332435,
        debet: 0,
        kredit: 3717100,
        saldoAkhir: 42049535
      },
      {
        code: "112",
        name: "ii. Biosolar B35 (Subsidi)",
        level: 4,
        saldoKemarin: 309514184,
        debet: 16845204,
        kredit: 26040410,
        saldoAkhir: 318709390
      },
      {
        code: "113",
        name: "-. Pertamax RON 92 & Dex Series",
        level: 4,
        saldoKemarin: 1774912015,
        debet: 67816753,
        kredit: 296766742,
        saldoAkhir: 2003862004
      },
      {
        code: "-",
        name: "b. Penjualan Pelumas & Produk Non-BBM",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "124",
        name: "-. Pelumas Fastron, Enduro & Mesran",
        level: 4,
        saldoKemarin: 111945272,
        debet: 0,
        kredit: 7530924,
        saldoAkhir: 119476196
      },
      {
        code: "-",
        name: "2. Pendapatan Operasional Lainnya",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "136",
        name: "a. Pendapatan Sewa Tenant & Bright Store",
        level: 3,
        saldoKemarin: 22750000,
        debet: 0,
        kredit: 994000,
        saldoAkhir: 23744000
      },
      {
        code: "137",
        name: "b. Pendapatan Selisih Tera Positif Nozzle",
        level: 3,
        saldoKemarin: 1640740505,
        debet: 0,
        kredit: 5773040,
        saldoAkhir: 1646513545
      },
      {
        code: "143",
        name: "c. Pendapatan Jasa Layanan Nitrogen & Kompresor",
        level: 3,
        saldoKemarin: 50013109,
        debet: 0,
        kredit: 5550497,
        saldoAkhir: 55563606
      },
      {
        code: "-",
        name: "3. Pendapatan Non Operasional",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "311",
        name: "a. Penjualan Drum Bekas & Limbah Pelumas",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        code: "317",
        name: "b. Pendapatan Bunga Jasa Giro Operasional",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        code: "318",
        name: "c. Lainnya",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      // TOTAL PENDAPATAN
      {
        code: "",
        name: "JUMLAH PENDAPATAN",
        level: 1,
        saldoKemarin: 3948207520,
        debet: 84661957,
        kredit: 346372713,
        saldoAkhir: 4209918276,
        isTotal: true
      },

      // === B. BEBAN OPERASIONAL ===
      {
        code: "150",
        name: "B. Beban Operasional",
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "-",
        name: "1. Harga Pokok Penjualan (HPP) DO Pertamina",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "-",
        name: "a. Penebusan DO BBM Retail",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "161",
        name: "i.    DO Pertalite RON 90",
        level: 4,
        saldoKemarin: 93695592,
        debet: 12700756,
        kredit: 0,
        saldoAkhir: 106396348
      },
      {
        code: "162",
        name: "ii.   DO Biosolar B35",
        level: 4,
        saldoKemarin: 740290634,
        debet: 55007683,
        kredit: 180411,
        saldoAkhir: 795117906
      },
      {
        code: "163",
        name: "iii.  DO Pertamax RON 92",
        level: 4,
        saldoKemarin: 17491887,
        debet: 2540140,
        kredit: 0,
        saldoAkhir: 20032027
      },
      {
        code: "168",
        name: "iv.   Ongkos Angkut Mobil Tangki Pertamina",
        level: 4,
        saldoKemarin: 41101500,
        debet: 0,
        kredit: 0,
        saldoAkhir: 41101500
      },
      {
        code: "-",
        name: "2. Beban Kerugian & Selisih Tera",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "174",
        name: "a. Kerugian Penguapan & Losses Tanki Pendam",
        level: 3,
        saldoKemarin: 8937971,
        debet: 0,
        kredit: 0,
        saldoAkhir: 8937971
      },
      {
        code: "176",
        name: "b. Selisih Tera Negatif Nozzle Dispenser",
        level: 3,
        saldoKemarin: 647415694,
        debet: 11392147,
        kredit: 0,
        saldoAkhir: 658807841
      },
      {
        code: "180",
        name: "3. Beban Pemasaran & Promosi SPBU",
        level: 2,
        saldoKemarin: 58679000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 58679000
      },
      {
        code: "-",
        name: "4. Beban Administrasi dan Umum",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "-",
        name: "a. Beban Tenaga Kerja SPBU",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "201",
        name: "i.   Gaji dan Upah Operator Shift",
        level: 4,
        saldoKemarin: 1445678201,
        debet: 1395000,
        kredit: 0,
        saldoAkhir: 1447073201
      },
      {
        code: "202",
        name: "ii.  Honorarium Pengawas & Security",
        level: 4,
        saldoKemarin: 108680000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 108680000
      },
      {
        code: "203",
        name: "iii. Tunjangan & BPJS Ketenagakerjaan",
        level: 4,
        saldoKemarin: 345474070,
        debet: 0,
        kredit: 0,
        saldoAkhir: 345474070
      },
      {
        code: "204",
        name: "b. Beban Pendidikan, Pelatihan & K3 SPBU",
        level: 3,
        saldoKemarin: 58372009,
        debet: 0,
        kredit: 0,
        saldoAkhir: 58372009
      },
      {
        code: "-",
        name: "c. Beban Sewa",
        level: 3,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "205",
        name: "i.   Sewa Lahan SPBU",
        level: 4,
        saldoKemarin: 19964000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 19964000
      },
      {
        code: "207",
        name: "d. Beban Penyusutan Dispenser & Kanopi SPBU",
        level: 3,
        saldoKemarin: 133072770,
        debet: 0,
        kredit: 0,
        saldoAkhir: 133072770
      },
      {
        code: "208",
        name: "e. Beban Amortisasi Perizinan SPBU",
        level: 3,
        saldoKemarin: 999987,
        debet: 0,
        kredit: 0,
        saldoAkhir: 999987
      },
      {
        code: "209",
        name: "f. Beban Asuransi Kebakaran & SPBU",
        level: 3,
        saldoKemarin: 3824200,
        debet: 0,
        kredit: 0,
        saldoAkhir: 3824200
      },
      {
        code: "210",
        name: "g. Beban Pemeliharaan Dispenser, Pompa & Tanki",
        level: 3,
        saldoKemarin: 58611000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 58611000
      },
      {
        code: "211",
        name: "h. Beban Listrik PLN, Air & Bahan Bakar Genset",
        level: 3,
        saldoKemarin: 254226500,
        debet: 504000,
        kredit: 0,
        saldoAkhir: 254730500
      },
      {
        code: "215",
        name: "i. Pajak-pajak & Retribusi Daerah",
        level: 3,
        saldoKemarin: 7472000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 7472000
      },
      {
        code: "226",
        name: "j. Beban Perlengkapan Struk & Cetak Kasir",
        level: 3,
        saldoKemarin: 116289100,
        debet: 1560000,
        kredit: 0,
        saldoAkhir: 117849100
      },
      {
        code: "-",
        name: "5. Beban Non Operasional",
        level: 2,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      },
      {
        code: "359",
        name: "a. Beban Administrasi Bank & Bunga Pinjaman",
        level: 3,
        saldoKemarin: 29287000,
        debet: 0,
        kredit: 0,
        saldoAkhir: 29287000
      },
      // TOTAL BIAYA
      {
        code: "",
        name: "JUMLAH BIAYA",
        level: 1,
        saldoKemarin: 4189563115,
        debet: 85099726,
        kredit: 180411,
        saldoAkhir: 4274482430,
        isTotal: true
      },

      // === LABA RUGI & PAJAK SUMMARY ===
      {
        code: "400",
        name: "Laba Rugi Operasional",
        level: 1,
        saldoKemarin: -241355595,
        debet: 0,
        kredit: 0,
        saldoAkhir: -64564154,
        isTotal: true
      },
      {
        code: "401",
        name: "Laba Rugi Non Operasional",
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        code: "402",
        name: "Laba Rugi Sebelum Taksiran Pajak",
        level: 1,
        saldoKemarin: -241355595,
        debet: 0,
        kredit: 0,
        saldoAkhir: -64564154,
        isTotal: true
      },
      {
        code: "403",
        name: "Taksiran Pajak Penghasilan",
        level: 1,
        saldoKemarin: 13635062,
        debet: 0,
        kredit: 0,
        saldoAkhir: 13635062
      },
      {
        code: "404",
        name: "Pendapatan Pajak Tangguhan",
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        code: "405",
        name: "Biaya Pajak Tangguhan",
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      },
      {
        code: "406",
        name: "Laba/Rugi Net",
        level: 1,
        saldoKemarin: -254990657,
        debet: 0,
        kredit: 0,
        saldoAkhir: -78199216,
        isGrandTotal: true
      }
    ]
  },
  arusKas: {
    period: "September 2026",
    operasional: [
      { name: "Penerimaan Kas dari Pelanggan BBM", amount: 545200000 },
      { name: "Pembayaran Kas ke Pemasok (Pertamina)", amount: -524500000 },
      { name: "Pembayaran Beban Operasional & Gaji", amount: -31000000 }
    ],
    investasi: [
      { name: "Pembelian Suku Cadang Nozzle & Selang", amount: -4500000 }
    ],
    pendanaan: [
      { name: "Prive / Penarikan Pemilik", amount: -15000000 }
    ],
    saldoAwal: 84620000
  },
  stokPenjualan: [
    {
      code: "PLT",
      name: "Pertalite",
      stokAwal: 12500,
      pembelian: 16000,
      penjualan: 7050,
      penyesuaian: 0,
      stokAkhir: 21450,
      unit: "Liter",
      kapasitasTanki: 30000,
      persenTerisi: 71.5
    },
    {
      code: "PTX",
      name: "Pertamax",
      stokAwal: 8200,
      pembelian: 10000,
      penjualan: 4000,
      penyesuaian: 0,
      stokAkhir: 14200,
      unit: "Liter",
      kapasitasTanki: 20000,
      persenTerisi: 71.0
    },
    {
      code: "TUR",
      name: "Pertamax Turbo",
      stokAwal: 6000,
      pembelian: 0,
      penjualan: 1200,
      penyesuaian: 0,
      stokAkhir: 4800,
      unit: "Liter",
      kapasitasTanki: 15000,
      persenTerisi: 32.0
    },
    {
      code: "BSL",
      name: "Bio Solar",
      stokAwal: 14800,
      pembelian: 18000,
      penjualan: 7000,
      penyesuaian: 0,
      stokAkhir: 25800,
      unit: "Liter",
      kapasitasTanki: 30000,
      persenTerisi: 86.0
    },
    {
      code: "DXL",
      name: "Dexlite",
      stokAwal: 6200,
      pembelian: 8000,
      penjualan: 3000,
      penyesuaian: 0,
      stokAkhir: 11200,
      unit: "Liter",
      kapasitasTanki: 15000,
      persenTerisi: 74.6
    }
  ]
};
