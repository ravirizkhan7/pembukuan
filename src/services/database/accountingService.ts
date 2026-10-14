import { sqliteService } from './sqliteService';
import {
  transactionRepository,
  teraRepository,
  journalRepository,
  receivableRepository,
  payableRepository,
  accountRepository,
  masterCodeRepository,
  shiftRepository,
  businessPartnerRepository
} from './repositories';
import { calculateNewBalance } from '../postingEngine';
import type {
  Transaction,
  Tera,
  Journal,
  JournalEntry,
  Account,
  Receivable,
  Payable,
  Shift
} from '../../types';

export interface AccountingPostResult {
  success: boolean;
  error?: string;
  transaction?: Transaction;
  tera?: Tera;
  journal?: Journal;
  updatedAccounts?: Account[];
  updatedReceivables?: Receivable[];
  updatedPayables?: Payable[];
  updatedShifts?: Shift[];
}

/**
 * ACCOUNTING SERVICE (CORE TRANSAKSI & JURNAL SQLITE)
 * 
 * Bertanggung jawab mengeksekusi posting transaksi secara ATOMIK ke SQLite.
 * Menjamin:
 * 1. Seluruh operasi (transaksi, tera, jurnal umum, baris jurnal, buku pembantu,
 *    dan saldo akun COA) berada dalam satu batas transaksi database (BEGIN ... COMMIT).
 * 2. Jika salah satu langkah gagal, seluruh perubahan di-rollback secara penuh.
 * 3. Jurnal double-entry selalu seimbang (total debit == total credit).
 * 4. Tidak membuat transaksi/jurnal yatim.
 */
export class AccountingService {
  /**
   * Mengeksekusi transaksi bisnis dan membukukan jurnal akuntansi secara atomik ke SQLite.
   */
  public static async executeTransaction(params: {
    transaction: Transaction;
    tera?: Tera;
  }): Promise<AccountingPostResult> {
    const { transaction, tera } = params;

    try {
      // 1. Ambil Sesi Shift Aktif (jika tersedia)
      const activeShift = await shiftRepository.getActiveShift();

      if (transaction.total <= 0) {
        return {
          success: false,
          error: 'Nominal transaksi harus lebih besar dari 0.'
        };
      }

      // 2. Validasi Master Code di SQLite
      let masterCode = await masterCodeRepository.findByCode(transaction.code);
      if (!masterCode && transaction.masterCodeId) {
        masterCode = await masterCodeRepository.findById(transaction.masterCodeId);
      }

      if (!masterCode || !masterCode.isActive) {
        return {
          success: false,
          error: `Master Code "${transaction.code}" tidak ditemukan atau tidak aktif dalam sistem.`
        };
      }

      // 3. Validasi Mapping Akun Debit & Kredit di SQLite
      const debitAccount = await accountRepository.findById(masterCode.debitAccountId) ||
                           await accountRepository.findByCode(masterCode.debitAccountId);
      const creditAccount = await accountRepository.findById(masterCode.creditAccountId) ||
                            await accountRepository.findByCode(masterCode.creditAccountId);

      if (!debitAccount) {
        return {
          success: false,
          error: `Mapping akun gagal: Akun Debit [${masterCode.debitAccountId}] tidak ditemukan di Bagan Akun (COA).`
        };
      }

      if (!creditAccount) {
        return {
          success: false,
          error: `Mapping akun gagal: Akun Kredit [${masterCode.creditAccountId}] tidak ditemukan di Bagan Akun (COA).`
        };
      }

      // 4. Validasi Tera jika Master Code mewajibkan Tera
      let validatedTera = tera;
      if (masterCode.requiresTera) {
        if (!validatedTera) {
          return {
            success: false,
            error: `Transaksi kode ${masterCode.code} (${masterCode.name}) mewajibkan pencatatan Tera Nozzle.`
          };
        }

        if (validatedTera.teraAkhir < validatedTera.teraAwal) {
          return {
            success: false,
            error: `Meter tera akhir (${validatedTera.teraAkhir}) tidak boleh lebih kecil dari meter tera awal (${validatedTera.teraAwal}).`
          };
        }

        // Rumus tera: volume = teraAkhir - teraAwal, salesAmount = volume * price
        const expectedVolume = Number((validatedTera.teraAkhir - validatedTera.teraAwal).toFixed(2));
        const expectedSales = Math.round(expectedVolume * validatedTera.price);

        if (expectedVolume <= 0) {
          return {
            success: false,
            error: 'Volume penjualan dari pembacaan tera harus lebih besar dari 0.'
          };
        }

        validatedTera = {
          ...validatedTera,
          volume: expectedVolume,
          selisih: 0,
          salesAmount: expectedSales
        };
      }

      // 5. Validasi Siklus Piutang & Hutang
      const isPelunasanPiutang = masterCode.category === 'Pelunasan' && creditAccount.code === '1-1101';
      let targetReceivable: Receivable | null = null;
      let newRecOutstanding = 0;

      if (isPelunasanPiutang) {
        if (!transaction.relatedReceivableId) {
          return {
            success: false,
            error: 'Transaksi pelunasan piutang wajib memilih tagihan piutang terkait (relatedReceivableId).'
          };
        }
        targetReceivable = await receivableRepository.findById(transaction.relatedReceivableId);
        if (!targetReceivable) {
          return {
            success: false,
            error: `Faktur piutang dengan ID "${transaction.relatedReceivableId}" tidak ditemukan.`
          };
        }
        if (targetReceivable.status === 'Paid') {
          return {
            success: false,
            error: `Faktur piutang "${targetReceivable.id}" sudah berstatus lunas (Paid).`
          };
        }
        newRecOutstanding = targetReceivable.outstanding - transaction.total;
        if (newRecOutstanding < 0) {
          return {
            success: false,
            error: `Nominal pelunasan (Rp ${transaction.total.toLocaleString('id-ID')}) melebihi sisa piutang (Rp ${targetReceivable.outstanding.toLocaleString('id-ID')}).`
          };
        }
      }

      const isPembayaranHutang = masterCode.category === 'Pelunasan' && debitAccount.code === '2-1001';
      let targetPayable: Payable | null = null;
      let newPayOutstanding = 0;

      if (isPembayaranHutang) {
        if (!transaction.relatedPayableId) {
          return {
            success: false,
            error: 'Transaksi pembayaran hutang wajib memilih tagihan hutang terkait (relatedPayableId).'
          };
        }
        targetPayable = await payableRepository.findById(transaction.relatedPayableId);
        if (!targetPayable) {
          return {
            success: false,
            error: `Tagihan hutang dengan ID "${transaction.relatedPayableId}" tidak ditemukan.`
          };
        }
        if (targetPayable.status === 'Paid') {
          return {
            success: false,
            error: `Tagihan hutang "${targetPayable.id}" sudah berstatus lunas (Paid).`
          };
        }
        newPayOutstanding = targetPayable.outstanding - transaction.total;
        if (newPayOutstanding < 0) {
          return {
            success: false,
            error: `Nominal pembayaran (Rp ${transaction.total.toLocaleString('id-ID')}) melebihi sisa hutang (Rp ${targetPayable.outstanding.toLocaleString('id-ID')}).`
          };
        }
      }

      // Siapkan Business Partner
      let partnerId = transaction.partnerId;
      if (!partnerId) {
        if (masterCode.paymentMethod === 'Piutang' || debitAccount.code === '1-1101') {
          const partners = await businessPartnerRepository.findByType('Customer');
          if (partners.length > 0) partnerId = partners[0].id;
        } else if (masterCode.paymentMethod === 'Hutang' || creditAccount.code === '2-1001') {
          const partners = await businessPartnerRepository.findByType('Vendor');
          if (partners.length > 0) partnerId = partners[0].id;
        }
      }

      // Siapkan ID Transaksi, Tera, dan Jurnal
      const nowIso = new Date().toISOString();
      const txId = transaction.id || `TX-${Date.now().toString().slice(-6)}`;
      const teraId = validatedTera ? (validatedTera.id || `TRA-${Date.now().toString().slice(-4)}`) : undefined;
      const journalId = `JRN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const evidenceNo = `BKT/${transaction.date.slice(0, 10).replace(/[^0-9]/g, '')}/${txId.slice(-4)}`;

      // Penentuan Relasi Shift:
      // Jika transaksi memiliki shiftId spesifik, gunakan shiftId tersebut.
      // Jika transaksi administrasi tidak memiliki sesi shift, simpan tanpa relasi sesi (shiftId: null / undefined).
      // Jangan diam-diam mengaitkan transaksi ke sesi shift yang kebetulan aktif.
      const resolvedShiftId = transaction.shiftId ? transaction.shiftId : undefined;
      const resolvedShiftName = transaction.shift
        ? transaction.shift
        : (resolvedShiftId && activeShift?.id === resolvedShiftId ? activeShift.name : 'Tanpa Sesi / Administratif');
      const resolvedCashier = transaction.cashier
        ? transaction.cashier
        : (resolvedShiftId && activeShift?.id === resolvedShiftId ? activeShift.operator : 'Admin SPBU');

      // Final Data Transaksi
      const finalTx: Transaction = {
        ...transaction,
        id: txId,
        shiftId: resolvedShiftId,
        shift: resolvedShiftName,
        cashier: resolvedCashier,
        status: 'Selesai',
        teraId: teraId,
        partnerId: partnerId,
        paymentMethod: masterCode.paymentMethod
      };

      // Final Data Tera
      const finalTera: Tera | undefined = validatedTera ? {
        ...validatedTera,
        id: teraId!,
        shiftId: resolvedShiftId,
        shift: resolvedShiftName,
        officer: validatedTera.officer || resolvedCashier,
        transactionId: txId,
        status: 'Valid'
      } : undefined;

      // Jurnal Umum Double-Entry
      const entries: JournalEntry[] = [
        {
          accountId: debitAccount.id,
          accountCode: debitAccount.code,
          accountName: debitAccount.name,
          debit: transaction.total,
          credit: 0
        },
        {
          accountId: creditAccount.id,
          accountCode: creditAccount.code,
          accountName: creditAccount.name,
          debit: 0,
          credit: transaction.total
        }
      ];

      const journal: Journal = {
        id: journalId,
        date: transaction.date.slice(0, 10),
        transactionId: txId,
        evidenceNo: evidenceNo,
        transCode: transaction.code,
        description: transaction.name,
        entries: entries,
        isBalanced: true
      };

      // =========================================================================
      // EKSEKUSI TRANSAKSI ATOMIK (BEGIN ... COMMIT / ROLLBACK) DI SQLITE
      // =========================================================================
      await sqliteService.runTransaction(async () => {
        // 1. Simpan Tera Dispenser (jika ada)
        if (finalTera) {
          await teraRepository.create(finalTera);
        }

        // 2. Simpan Transaksi Selesai
        await transactionRepository.create(finalTx);

        // 3. Simpan Jurnal Umum & Detail Entries
        await journalRepository.create(journal);

        // 4. Sub-ledger Piutang
        if (masterCode.paymentMethod === 'Piutang' || debitAccount.code === '1-1101') {
          const recId = `REC-${Date.now().toString().slice(-6)}`;
          await receivableRepository.create({
            id: recId,
            transactionId: txId,
            partnerId: partnerId || 'CUS-001',
            partnerName: transaction.partnerName || 'Pelanggan',
            amount: transaction.total,
            outstanding: transaction.total,
            status: 'Open',
            date: transaction.date.slice(0, 10),
            notes: `${transaction.name} (${transaction.code})`
          });
        } else if (isPelunasanPiutang && targetReceivable) {
          const nextStatus = newRecOutstanding === 0 ? 'Paid' : 'Partial';
          await receivableRepository.updateOutstanding(targetReceivable.id, newRecOutstanding, nextStatus);
        }

        // 5. Sub-ledger Hutang
        if (masterCode.paymentMethod === 'Hutang' || creditAccount.code === '2-1001') {
          const payId = `PAY-${Date.now().toString().slice(-6)}`;
          await payableRepository.create({
            id: payId,
            transactionId: txId,
            partnerId: partnerId || 'VEN-001',
            partnerName: transaction.partnerName || 'Vendor',
            amount: transaction.total,
            outstanding: transaction.total,
            status: 'Open',
            date: transaction.date.slice(0, 10),
            notes: `${transaction.name} (${transaction.code})`
          });
        } else if (isPembayaranHutang && targetPayable) {
          const nextStatus = newPayOutstanding === 0 ? 'Paid' : 'Partial';
          await payableRepository.updateOutstanding(targetPayable.id, newPayOutstanding, nextStatus);
        }

        // 6. Mutasi Saldo Akun COA
        const newDebitBal = calculateNewBalance(debitAccount.balance, debitAccount.normalBalance, transaction.total, 0);
        await accountRepository.update(debitAccount.id, { balance: newDebitBal });

        const newCreditBal = calculateNewBalance(creditAccount.balance, creditAccount.normalBalance, 0, transaction.total);
        await accountRepository.update(creditAccount.id, { balance: newCreditBal });

        // 7. Akumulasi Total Penjualan Shift HANYA jika transaksi Penjualan memiliki relasi sesi shift aktif
        if (finalTx.shiftId && activeShift && finalTx.shiftId === activeShift.id && transaction.category === 'Penjualan') {
          await sqliteService.run(
            `UPDATE shifts SET total_sales = total_sales + ?, updated_at = ? WHERE id = ?;`,
            [transaction.total, nowIso, activeShift.id]
          );
          await sqliteService.run(
            `UPDATE shift_sessions SET total_sales = total_sales + ?, updated_at = ? WHERE shift_id = ? AND status = 'Aktif';`,
            [transaction.total, nowIso, activeShift.id]
          );
        }
      });

      // Ambil snapshot terupdate untuk sinkronisasi state React
      const [updatedAccounts, updatedReceivables, updatedPayables, updatedShifts] = await Promise.all([
        accountRepository.findAll(),
        receivableRepository.findAll(),
        payableRepository.findAll(),
        shiftRepository.getAllShifts()
      ]);

      return {
        success: true,
        transaction: finalTx,
        tera: finalTera,
        journal: journal,
        updatedAccounts,
        updatedReceivables,
        updatedPayables,
        updatedShifts
      };
    } catch (err: any) {
      console.error('[AccountingService] Gagal memposting transaksi:', err);
      return {
        success: false,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Pembatalan transaksi akuntansi:
   * Menolak pembatalan transaksi yang sudah diposting secara aman (fail-closed)
   * untuk menjaga integritas jurnal, buku besar, dan rekap shift.
   */
  public static async cancelTransaction(id: string, _cancelReason: string): Promise<AccountingPostResult> {
    return {
      success: false,
      error: `Pembalikan transaksi (reversal) belum didukung secara penuh pada fase ini. Pembatalan transaksi "${id}" yang sudah diposting ditolak secara aman untuk menjaga konsistensi jurnal, buku besar, dan rekap shift.`
    };
  }
}

export const accountingService = AccountingService;
