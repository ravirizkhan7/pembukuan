/**
 * MASTER DATA SERVICE (SQLITE INITIALIZATION & SYNC)
 * 
 * Bertanggung jawab melakukan seeding aman dan idempotent pada master data
 * pertama kali jika tabel terkait masih kosong, serta memuat master data dari SQLite.
 * 
 * Aturan Penting:
 * - Saldo akun (COA) WAJIB tetap bernilai 0 (tidak membawa nominal dummy mockAccounts).
 * - Tidak membuat jurnal pembukaan otomatis.
 * - Tidak menimpa data pengguna jika tabel sudah berisi data.
 */

import {
  ProductCategoryRepository,
  ProductRepository,
  TankRepository,
  NozzleRepository,
  AccountRepository,
  MasterCodeRepository,
  BusinessPartnerRepository,
  ShiftRepository,
  PegawaiRepository,
  AttendanceRepository,
  TransactionRepository,
  TeraRepository,
  JournalRepository,
  ReceivableRepository,
  PayableRepository,
  ReportRepository
} from './repositories';
import { sqliteService } from './sqliteService';
import type { SqlExecutor } from './migrationRunner';
import {
  mockProductCategories,
  mockProducts,
  mockTanks,
  mockNozzles,
  mockAccounts,
  mockMasterCodes,
  mockBusinessPartners,
  mockPegawai,
  mockStationInfo
} from '../../mock/mockData';
import type {
  StationInfo,
  ProductCategory,
  Product,
  Tank,
  Nozzle,
  Account,
  MasterCode,
  BusinessPartner,
  Shift,
  Pegawai,
  Attendance,
  Transaction,
  Tera,
  Journal,
  Receivable,
  Payable,
  ReportsData
} from '../../types';

export interface MasterDataSeedSummary {
  accountsSeeded: number;
  categoriesSeeded: number;
  productsSeeded: number;
  tanksSeeded: number;
  nozzlesSeeded: number;
  masterCodesSeeded: number;
  partnersSeeded: number;
  shiftsSeeded?: number;
  pegawaiSeeded?: number;
}

export interface MasterDataSnapshot {
  productCategories: ProductCategory[];
  accounts: Account[];
  products: Product[];
  tanks: Tank[];
  nozzles: Nozzle[];
  masterCodes: MasterCode[];
  businessPartners: BusinessPartner[];
  shifts: Shift[];
  pegawaiList: Pegawai[];
  attendances: Attendance[];
  transactions: Transaction[];
  teraList: Tera[];
  journals: Journal[];
  receivables: Receivable[];
  payables: Payable[];
  reports?: ReportsData;
  stationInfo?: StationInfo;
}

export class MasterDataService {
  /**
   * Menginisialisasi master data ke database SQLite jika tabel masih kosong.
   * Bersifat idempotent dan mempertahankan hierarki foreign key.
   */
  public static async initializeMasterData(
    executor: SqlExecutor = sqliteService
  ): Promise<MasterDataSeedSummary> {
    const summary: MasterDataSeedSummary = {
      accountsSeeded: 0,
      categoriesSeeded: 0,
      productsSeeded: 0,
      tanksSeeded: 0,
      nozzlesSeeded: 0,
      masterCodesSeeded: 0,
      partnersSeeded: 0
    };

    const accRepo = new AccountRepository(executor);
    const catRepo = new ProductCategoryRepository(executor);
    const prodRepo = new ProductRepository(executor);
    const tankRepo = new TankRepository(executor);
    const nozRepo = new NozzleRepository(executor);
    const mcRepo = new MasterCodeRepository(executor);
    const partnerRepo = new BusinessPartnerRepository(executor);

    // 1. Akun COA (Saldo diinisialisasi 0)
    const existingAccounts = await accRepo.findAll();
    if (existingAccounts.length === 0) {
      for (const a of mockAccounts) {
        await accRepo.create({
          id: a.id,
          code: a.code,
          name: a.name,
          category: a.category,
          normalBalance: a.normalBalance,
          balance: 0, // Wajib 0 sesuai ketetapan saldo awal riil
          isActive: a.isActive
        });
        summary.accountsSeeded++;
      }
    }

    // 2. Kategori Produk
    const existingCategories = await catRepo.findAll();
    if (existingCategories.length === 0) {
      for (const c of mockProductCategories) {
        await catRepo.create({
          id: c.id,
          name: c.name,
          status: c.status
        });
        summary.categoriesSeeded++;
      }
    }

    // 3. Produk (Bergantung pada Kategori)
    const existingProducts = await prodRepo.findAll();
    if (existingProducts.length === 0) {
      for (const p of mockProducts) {
        await prodRepo.create({
          id: p.id,
          code: p.code,
          name: p.name,
          categoryId: p.categoryId,
          sellPrice: p.sellPrice,
          buyPrice: p.buyPrice,
          unit: p.unit,
          color: p.color,
          status: p.status,
          tankId: p.tankId
        });
        summary.productsSeeded++;
      }
    }

    // 4. Tanki Pendam (Bergantung pada Produk)
    const existingTanks = await tankRepo.findAll();
    if (existingTanks.length === 0) {
      for (const t of mockTanks) {
        await tankRepo.create({
          id: t.id,
          name: t.name,
          productId: t.productId,
          capacity: t.capacity,
          currentStock: t.currentStock ?? 0,
          unit: t.unit || 'Liter',
          lastSounding: t.lastSounding || '',
          status: t.status
        });
        summary.tanksSeeded++;
      }
    }

    // 5. Nozzle Dispenser (Bergantung pada Tanki dan Produk)
    const existingNozzles = await nozRepo.findAll();
    if (existingNozzles.length === 0) {
      for (const n of mockNozzles) {
        await nozRepo.create({
          id: n.id,
          code: n.code,
          island: n.island,
          tankId: n.tankId,
          productId: n.productId,
          currentMeter: n.currentMeter ?? 0,
          status: n.status
        });
        summary.nozzlesSeeded++;
      }
    }

    // 6. Master Kode (Bergantung pada Akun Debit/Kredit dan Produk)
    const existingMasterCodes = await mcRepo.findAll();
    if (existingMasterCodes.length === 0) {
      for (const mc of mockMasterCodes) {
        await mcRepo.create({
          id: mc.id,
          code: mc.code,
          name: mc.name,
          category: mc.category,
          type: mc.type,
          requiresTera: mc.requiresTera,
          productId: mc.productId,
          unitPrice: mc.unitPrice,
          debitAccountId: mc.debitAccountId,
          debitAccountName: mc.debitAccountName || '',
          creditAccountId: mc.creditAccountId,
          creditAccountName: mc.creditAccountName || '',
          description: mc.description || '',
          paymentMethod: mc.paymentMethod,
          isActive: mc.isActive
        });
        summary.masterCodesSeeded++;
      }
    }

    // 7. Mitra Bisnis
    const existingPartners = await partnerRepo.findAll();
    if (existingPartners.length === 0) {
      for (const bp of mockBusinessPartners) {
        await partnerRepo.create({
          id: bp.id,
          code: bp.code,
          name: bp.name,
          type: bp.type,
          phone: bp.phone,
          address: bp.address,
          isActive: true
        });
        summary.partnersSeeded++;
      }
    }

    // 8. Jadwal Shift Standar (SFT-01: 07:00-15:00, SFT-02: 15:00-23:00)
    // Sesuai aturan: status 'Menunggu', 0 sales, 0 handover (tidak memasukkan mock operasional aktif)
    const shiftRepo = new ShiftRepository(executor);
    const existingShifts = await shiftRepo.getAllShifts();
    if (existingShifts.length === 0) {
      const defaultDefinitions: Shift[] = [
        {
          id: 'SFT-01',
          name: 'Shift 1',
          startTime: '07:00',
          endTime: '15:00',
          operator: 'Ahmad Fauzi',
          status: 'Menunggu',
          totalSales: 0,
          cashHandover: 0,
          date: '2026-09-24',
          initialCash: 0,
          discrepancy: 0
        },
        {
          id: 'SFT-02',
          name: 'Shift 2',
          startTime: '15:00',
          endTime: '23:00',
          operator: 'Siti Rahma',
          status: 'Menunggu',
          totalSales: 0,
          cashHandover: 0,
          date: '2026-09-24',
          initialCash: 0,
          discrepancy: 0
        }
      ];
      await shiftRepo.initShiftDefinitions(defaultDefinitions);
      summary.shiftsSeeded = defaultDefinitions.length;
    }

    // 9. Master Pegawai (Roster Pengembangan)
    // Sesuai aturan: jangan mengarang data resmi, pertahankan status sebagai data pengembangan jika roster masih placeholder
    const pegawaiRepo = new PegawaiRepository(executor);
    const existingPegawai = await pegawaiRepo.findAll();
    if (existingPegawai.length === 0) {
      await pegawaiRepo.initRoster(mockPegawai);
      summary.pegawaiSeeded = mockPegawai.length;
    }

    // 10. Profil SPBU & Metadata Pimpinan (station_info)
    const existingStation = await executor.query<any>('SELECT id FROM station_info LIMIT 1;');
    if (existingStation.length === 0) {
      const cols = await executor.query<{ name: string }>('PRAGMA table_info(station_info);');
      const hasCity = cols.some((c) => c.name === 'city');
      const now = new Date().toISOString();
      if (hasCity) {
        await executor.run(
          `INSERT INTO station_info (id, name, address, city, phone, manager, email, status, last_backup, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            mockStationInfo.id,
            mockStationInfo.name,
            mockStationInfo.address,
            mockStationInfo.city || null,
            mockStationInfo.phone,
            mockStationInfo.manager,
            mockStationInfo.email,
            mockStationInfo.status,
            mockStationInfo.lastBackup || null,
            mockStationInfo.version,
            now,
            now
          ]
        );
      } else {
        await executor.run(
          `INSERT INTO station_info (id, name, address, phone, manager, email, status, last_backup, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            mockStationInfo.id,
            mockStationInfo.name,
            mockStationInfo.address,
            mockStationInfo.phone,
            mockStationInfo.manager,
            mockStationInfo.email,
            mockStationInfo.status,
            mockStationInfo.lastBackup || null,
            mockStationInfo.version,
            now,
            now
          ]
        );
      }
    }

    return summary;
  }

  /**
   * Mengambil data master terkini dari SQLite
   */
  public static async loadAllMasterData(
    executor: SqlExecutor = sqliteService
  ): Promise<MasterDataSnapshot> {
    const accRepo = new AccountRepository(executor);
    const catRepo = new ProductCategoryRepository(executor);
    const prodRepo = new ProductRepository(executor);
    const tankRepo = new TankRepository(executor);
    const nozRepo = new NozzleRepository(executor);
    const mcRepo = new MasterCodeRepository(executor);
    const partnerRepo = new BusinessPartnerRepository(executor);
    const shiftRepo = new ShiftRepository(executor);
    const pegawaiRepo = new PegawaiRepository(executor);
    const attendanceRepo = new AttendanceRepository(executor);
    const txRepo = new TransactionRepository(executor);
    const teraRepo = new TeraRepository(executor);
    const jrnRepo = new JournalRepository(executor);
    const recRepo = new ReceivableRepository(executor);
    const payRepo = new PayableRepository(executor);
    const reportRepo = new ReportRepository(executor);

    const [
      accounts,
      productCategories,
      products,
      tanks,
      nozzles,
      masterCodes,
      businessPartners,
      shifts,
      pegawaiList,
      attendances,
      transactions,
      teraList,
      journals,
      receivables,
      payables,
      reports,
      stationRows
    ] = await Promise.all([
      accRepo.findAll(),
      catRepo.findAll(),
      prodRepo.findAll(),
      tankRepo.findAll(),
      nozRepo.findAll(),
      mcRepo.findAll(),
      partnerRepo.findAll(),
      shiftRepo.getAllShifts(),
      pegawaiRepo.findAll(),
      attendanceRepo.findAll(),
      txRepo.findAll(),
      teraRepo.findAll(),
      jrnRepo.findAll(),
      recRepo.findAll(),
      payRepo.findAll(),
      reportRepo.getAllReports(),
      executor.query<any>('SELECT * FROM station_info LIMIT 1;')
    ]);

    let stationInfo: StationInfo | undefined = undefined;
    if (stationRows && stationRows.length > 0) {
      const s = stationRows[0];
      stationInfo = {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city || undefined,
        phone: s.phone,
        manager: s.manager,
        email: s.email,
        status: s.status,
        lastBackup: s.last_backup || '',
        version: s.version || '1.0.0'
      };
    }

    return {
      accounts,
      productCategories,
      products,
      tanks,
      nozzles,
      masterCodes,
      businessPartners,
      shifts,
      pegawaiList,
      attendances,
      transactions,
      teraList,
      journals,
      receivables,
      payables,
      reports,
      stationInfo
    };
  }
}
