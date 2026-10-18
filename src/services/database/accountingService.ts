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
  businessPartnerRepository,
  transactionCorrectionRepository,
  TransactionRepository,
  TeraRepository,
  JournalRepository,
  ReceivableRepository,
  PayableRepository,
  AccountRepository,
  MasterCodeRepository,
  ShiftRepository,
  BusinessPartnerRepository,
  TransactionCorrectionRepository
} from './repositories';
import { calculateNewBalance } from '../postingEngine';
import type { SqlExecutor } from './migrationRunner';
import type {
  Transaction,
  Tera,
  Journal,
  JournalEntry,
  Account,
  Receivable,
  Payable,
  Shift,
  TransactionCorrection
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

export interface TransactionCorrectionResult {
  success: boolean;
  error?: string;
  originalTransaction?: Transaction;
  reversalJournal?: Journal;
  replacementTransaction?: Transaction;
  replacementJournal?: Journal;
  correction?: TransactionCorrection;
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
    executor?: SqlExecutor;
  }): Promise<AccountingPostResult> {
    const { transaction, tera, executor } = params;

    const exec = executor || sqliteService;
    const shiftRepo = executor ? new ShiftRepository(executor) : shiftRepository;
    const mcRepo = executor ? new MasterCodeRepository(executor) : masterCodeRepository;
    const accRepo = executor ? new AccountRepository(executor) : accountRepository;
    const txRepo = executor ? new TransactionRepository(executor) : transactionRepository;
    const jrnRepo = executor ? new JournalRepository(executor) : journalRepository;
    const teraRepo = executor ? new TeraRepository(executor) : teraRepository;
    const recRepo = executor ? new ReceivableRepository(executor) : receivableRepository;
    const payRepo = executor ? new PayableRepository(executor) : payableRepository;
    const bpRepo = executor ? new BusinessPartnerRepository(executor) : businessPartnerRepository;

    try {
      // 1. Ambil Sesi Shift Aktif (jika tersedia)
      const activeShift = await shiftRepo.getActiveShift();

      if (transaction.total <= 0) {
        return {
          success: false,
          error: 'Nominal transaksi harus lebih besar dari 0.'
        };
      }

      // 2. Validasi Master Code di SQLite
      let masterCode = await mcRepo.findByCode(transaction.code);
      if (!masterCode && transaction.masterCodeId) {
        masterCode = await mcRepo.findById(transaction.masterCodeId);
      }

      if (!masterCode || !masterCode.isActive) {
        return {
          success: false,
          error: `Master Code "${transaction.code}" tidak ditemukan atau tidak aktif dalam sistem.`
        };
      }

      // 3. Validasi Mapping Akun Debit & Kredit di SQLite
      const debitAccount = await accRepo.findById(masterCode.debitAccountId) ||
                           await accRepo.findByCode(masterCode.debitAccountId);
      const creditAccount = await accRepo.findById(masterCode.creditAccountId) ||
                            await accRepo.findByCode(masterCode.creditAccountId);

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
        targetReceivable = await recRepo.findById(transaction.relatedReceivableId);
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
        targetPayable = await payRepo.findById(transaction.relatedPayableId);
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
          const partners = await bpRepo.findByType('Customer');
          if (partners.length > 0) partnerId = partners[0].id;
        } else if (masterCode.paymentMethod === 'Hutang' || creditAccount.code === '2-1001') {
          const partners = await bpRepo.findByType('Vendor');
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
      const runInTx = async (action: () => Promise<void>) => {
        if (executor) {
          await executor.run('BEGIN TRANSACTION;');
          try {
            await action();
            await executor.run('COMMIT;');
          } catch (txErr) {
            await executor.run('ROLLBACK;');
            throw txErr;
          }
        } else {
          await sqliteService.runTransaction(action);
        }
      };

      await runInTx(async () => {
        // 1. Simpan Tera Dispenser (jika ada)
        if (finalTera) {
          await teraRepo.create(finalTera);
        }

        // 2. Simpan Transaksi Selesai
        await txRepo.create(finalTx);

        // 3. Simpan Jurnal Umum & Detail Entries
        await jrnRepo.create(journal);

        // 4. Sub-ledger Piutang
        if (masterCode.paymentMethod === 'Piutang' || debitAccount.code === '1-1101') {
          const recId = `REC-${Date.now().toString().slice(-6)}`;
          await recRepo.create({
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
          await recRepo.updateOutstanding(targetReceivable.id, newRecOutstanding, nextStatus);
        }

        // 5. Sub-ledger Hutang
        if (masterCode.paymentMethod === 'Hutang' || creditAccount.code === '2-1001') {
          const payId = `PAY-${Date.now().toString().slice(-6)}`;
          await payRepo.create({
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
          await payRepo.updateOutstanding(targetPayable.id, newPayOutstanding, nextStatus);
        }

        // 6. Mutasi Saldo Akun COA
        const newDebitBal = calculateNewBalance(debitAccount.balance, debitAccount.normalBalance, transaction.total, 0);
        await accRepo.update(debitAccount.id, { balance: newDebitBal });

        const newCreditBal = calculateNewBalance(creditAccount.balance, creditAccount.normalBalance, 0, transaction.total);
        await accRepo.update(creditAccount.id, { balance: newCreditBal });

        // 7. Akumulasi Total Penjualan Shift HANYA jika transaksi Penjualan memiliki relasi sesi shift aktif
        if (finalTx.shiftId && activeShift && finalTx.shiftId === activeShift.id && transaction.category === 'Penjualan') {
          await exec.run(
            `UPDATE shifts SET total_sales = total_sales + ?, updated_at = ? WHERE id = ?;`,
            [transaction.total, nowIso, activeShift.id]
          );
          await exec.run(
            `UPDATE shift_sessions SET total_sales = total_sales + ?, updated_at = ? WHERE shift_id = ? AND status = 'Aktif';`,
            [transaction.total, nowIso, activeShift.id]
          );
        }
      });

      // Ambil snapshot terupdate untuk sinkronisasi state React
      const [updatedAccounts, updatedReceivables, updatedPayables, updatedShifts] = await Promise.all([
        accRepo.findAll(),
        recRepo.findAll(),
        payRepo.findAll(),
        shiftRepo.getAllShifts()
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

  /**
   * Mengoreksi transaksi administrasi yang sudah diposting secara aman, berlandaskan prinsip akuntansi double-entry.
   * Seluruh tahapan pembalikan (reversal), pemulihan saldo COA, pemulihan sub-ledger,
   * pencatatan audit trail, pembatalan transaksi lama, dan posting transaksi pengganti
   * dieksekusi secara ATOMIK dalam satu batas transaksi database tunggal (BEGIN ... COMMIT).
   */
  public static async correctTransaction(params: {
    originalTransactionId: string;
    reason: string;
    replacementData: Transaction;
    user?: string;
    executor?: SqlExecutor;
  }): Promise<TransactionCorrectionResult> {
    const { originalTransactionId, reason, replacementData, user, executor } = params;

    const exec = executor || sqliteService;
    const shiftRepo = executor ? new ShiftRepository(executor) : shiftRepository;
    const mcRepo = executor ? new MasterCodeRepository(executor) : masterCodeRepository;
    const accRepo = executor ? new AccountRepository(executor) : accountRepository;
    const txRepo = executor ? new TransactionRepository(executor) : transactionRepository;
    const jrnRepo = executor ? new JournalRepository(executor) : journalRepository;
    const recRepo = executor ? new ReceivableRepository(executor) : receivableRepository;
    const payRepo = executor ? new PayableRepository(executor) : payableRepository;
    const bpRepo = executor ? new BusinessPartnerRepository(executor) : businessPartnerRepository;
    const corrRepo = executor ? new TransactionCorrectionRepository(executor) : transactionCorrectionRepository;

    try {
      // 1. Validasi Alasan Koreksi
      if (!reason || !reason.trim()) {
        return {
          success: false,
          error: 'Alasan koreksi transaksi wajib diisi.'
        };
      }

      // 2. Validasi Transaksi Asal
      const originalTx = await txRepo.findById(originalTransactionId);
      if (!originalTx) {
        return {
          success: false,
          error: `Transaksi asal dengan ID "${originalTransactionId}" tidak ditemukan.`
        };
      }

      if (originalTx.status !== 'Selesai') {
        return {
          success: false,
          error: `Hanya transaksi berstatus Selesai yang dapat dikoreksi. Status saat ini: ${originalTx.status}.`
        };
      }

      if (originalTx.isCorrected) {
        return {
          success: false,
          error: 'Transaksi ini sudah pernah dikoreksi sebelumnya dan tidak dapat dikoreksi ulang.'
        };
      }

      const existingCorr = await corrRepo.findByOriginalTransactionId(originalTx.id);
      if (existingCorr) {
        return {
          success: false,
          error: 'Transaksi ini sudah memiliki riwayat pembalikan/koreksi di sistem.'
        };
      }

      // 3. Batasan Operasional: Dispenser & Tera Nozzle
      if (originalTx.teraId || originalTx.nozzleId) {
        return {
          success: false,
          error: 'Koreksi transaksi dengan pencatatan dispenser/tera nozzle belum didukung pada tahap ini untuk menjaga konsistensi fisik meteran pompa.'
        };
      }

      // 4. Batasan Shift: Transaksi pada sesi shift tertutup terkunci
      let activeShift: Shift | null = null;
      if (originalTx.shiftId) {
        const shiftObj = await shiftRepo.findById(originalTx.shiftId);
        if (!shiftObj || shiftObj.status !== 'Aktif') {
          return {
            success: false,
            error: 'Transaksi berasal dari sesi shift yang sudah ditutup atau tidak aktif. Transaksi pada shift tertutup terkunci dan tidak dapat dikoreksi.'
          };
        }
        activeShift = shiftObj;
      }

      // 5. Validasi Jurnal Transaksi Asal
      const originalJournal = await jrnRepo.findByTransactionId(originalTx.id);
      if (!originalJournal || !originalJournal.entries || originalJournal.entries.length === 0) {
        return {
          success: false,
          error: 'Transaksi asal tidak memiliki jurnal akuntansi yang valid.'
        };
      }

      const origDebit = originalJournal.entries.reduce((sum, e) => sum + e.debit, 0);
      const origCredit = originalJournal.entries.reduce((sum, e) => sum + e.credit, 0);
      if (origDebit !== origCredit || origDebit <= 0) {
        return {
          success: false,
          error: 'Jurnal transaksi asal tidak seimbang (debit != kredit) atau bernilai 0.'
        };
      }

      const revRows = await exec.query<any>(
        `SELECT id FROM journals WHERE reverses_journal_id = ? LIMIT 1;`,
        [originalJournal.id]
      );
      if (revRows && revRows.length > 0) {
        return {
          success: false,
          error: `Jurnal transaksi asal sudah pernah dibalik sebelumnya oleh jurnal ${revRows[0].id}.`
        };
      }

      // 6. Validasi Integritas Sub-ledger Piutang & Hutang
      if (originalTx.category === 'Pelunasan' || originalTx.relatedReceivableId || originalTx.relatedPayableId) {
        return {
          success: false,
          error: 'Transaksi pelunasan piutang/hutang tidak dapat dikoreksi langsung karena telah memengaruhi saldo tagihan lain secara lanjutan.'
        };
      }

      const origRec = await recRepo.findByTransactionId(originalTx.id);
      if (origRec) {
        if (origRec.status !== 'Open' || origRec.outstanding < origRec.amount) {
          return {
            success: false,
            error: 'Faktur piutang dari transaksi ini sudah terkait dengan pembayaran sebagian atau pelunasan. Koreksi ditolak untuk mencegah ambiguitas saldo tagihan.'
          };
        }
      }

      const origPay = await payRepo.findByTransactionId(originalTx.id);
      if (origPay) {
        if (origPay.status !== 'Open' || origPay.outstanding < origPay.amount) {
          return {
            success: false,
            error: 'Faktur hutang dari transaksi ini sudah terkait dengan pembayaran sebagian atau pelunasan. Koreksi ditolak untuk mencegah ambiguitas saldo tagihan.'
          };
        }
      }

      // 7. Validasi Transaksi Pengganti
      if (!replacementData.total || replacementData.total <= 0) {
        return {
          success: false,
          error: 'Nominal transaksi pengganti harus lebih besar dari 0.'
        };
      }

      let repMasterCode = await mcRepo.findByCode(replacementData.code);
      if (!repMasterCode && replacementData.masterCodeId) {
        repMasterCode = await mcRepo.findById(replacementData.masterCodeId);
      }
      if (!repMasterCode || !repMasterCode.isActive) {
        return {
          success: false,
          error: `Master Code pengganti "${replacementData.code}" tidak ditemukan atau tidak aktif dalam sistem.`
        };
      }

      if (repMasterCode.requiresTera) {
        return {
          success: false,
          error: 'Transaksi pengganti tidak boleh menggunakan kode yang mewajibkan pencatatan tera nozzle.'
        };
      }

      if (repMasterCode.category === 'Pelunasan') {
        return {
          success: false,
          error: 'Transaksi pengganti tidak boleh berkategori Pelunasan.'
        };
      }

      const repDebitAccount = (await accRepo.findById(repMasterCode.debitAccountId)) ||
                              (await accRepo.findByCode(repMasterCode.debitAccountId));
      const repCreditAccount = (await accRepo.findById(repMasterCode.creditAccountId)) ||
                               (await accRepo.findByCode(repMasterCode.creditAccountId));

      if (!repDebitAccount || !repCreditAccount) {
        return {
          success: false,
          error: 'Mapping akun debit atau kredit untuk transaksi pengganti tidak ditemukan di Bagan Akun (COA).'
        };
      }

      // 8. Penyiapan Entri Jurnal Pembalik & Transaksi Pengganti
      const nowIso = new Date().toISOString();
      const nowStamp = Date.now().toString().slice(-6);
      const rand = Math.floor(Math.random() * 900 + 100);

      // A. Jurnal Pembalik (Double-entry Inverted)
      const revJournalId = `JRN-REV-${nowStamp}-${rand}`;
      const revEvidenceNo = `BKT/REV/${originalTx.code}/${originalTx.id.slice(-4)}`;
      const reversalEntries: JournalEntry[] = originalJournal.entries.map((entry) => ({
        accountId: entry.accountId,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debit: entry.credit,   // Dibalik: kredit lama menjadi debit pembalik
        credit: entry.debit    // Dibalik: debit lama menjadi kredit pembalik
      }));

      const reversalJournal: Journal = {
        id: revJournalId,
        date: replacementData.date ? replacementData.date.slice(0, 10) : originalTx.date.slice(0, 10),
        transactionId: originalTx.id,
        evidenceNo: revEvidenceNo,
        transCode: originalTx.code,
        description: `[PEMBALIKAN] ${originalTx.name} - ${reason.trim()}`,
        entries: reversalEntries,
        isBalanced: true,
        isReversal: true,
        reversesJournalId: originalJournal.id
      };

      // B. Data Transaksi Pengganti
      const replacementTxId = replacementData.id || `TX-${nowStamp}-${rand}`;
      const repEvidenceNo = `BKT/${(replacementData.date || originalTx.date).slice(0, 10).replace(/[^0-9]/g, '')}/${replacementTxId.slice(-4)}`;

      let repPartnerId = replacementData.partnerId;
      if (!repPartnerId) {
        if (repMasterCode.paymentMethod === 'Piutang' || repDebitAccount.code === '1-1101') {
          const partners = await bpRepo.findByType('Customer');
          if (partners.length > 0) repPartnerId = partners[0].id;
        } else if (repMasterCode.paymentMethod === 'Hutang' || repCreditAccount.code === '2-1001') {
          const partners = await bpRepo.findByType('Vendor');
          if (partners.length > 0) repPartnerId = partners[0].id;
        }
      }

      const finalReplacementTx: Transaction = {
        ...replacementData,
        id: replacementTxId,
        date: replacementData.date || originalTx.date,
        shiftId: originalTx.shiftId,
        shift: originalTx.shift,
        cashier: replacementData.cashier || originalTx.cashier,
        status: 'Selesai',
        partnerId: repPartnerId,
        paymentMethod: repMasterCode.paymentMethod,
        isCorrected: false,
        correctionId: undefined
      };

      // C. Jurnal Pengganti
      const repJournalId = `JRN-${nowStamp}-${rand}`;
      const repEntries: JournalEntry[] = [
        {
          accountId: repDebitAccount.id,
          accountCode: repDebitAccount.code,
          accountName: repDebitAccount.name,
          debit: replacementData.total,
          credit: 0
        },
        {
          accountId: repCreditAccount.id,
          accountCode: repCreditAccount.code,
          accountName: repCreditAccount.name,
          debit: 0,
          credit: replacementData.total
        }
      ];

      const replacementJournal: Journal = {
        id: repJournalId,
        date: (replacementData.date || originalTx.date).slice(0, 10),
        transactionId: replacementTxId,
        evidenceNo: repEvidenceNo,
        transCode: replacementData.code,
        description: replacementData.name,
        entries: repEntries,
        isBalanced: true,
        isReversal: false
      };

      // D. Entri Audit Trail Koreksi
      const correctionId = `CORR-${nowStamp}-${rand}`;
      const correctionRecord: TransactionCorrection = {
        id: correctionId,
        originalTransactionId: originalTx.id,
        reversalJournalId: revJournalId,
        replacementTransactionId: replacementTxId,
        reason: reason.trim(),
        correctedBy: user || 'Admin SPBU',
        createdAt: nowIso
      };

      // 9. EKSEKUSI ATOMIK DALAM SATU BATAS TRANSAKSI DATABASE (FAIL-CLOSED)
      const runInTx = async (action: () => Promise<void>) => {
        if (executor) {
          await executor.run('BEGIN TRANSACTION;');
          try {
            await action();
            await executor.run('COMMIT;');
          } catch (txErr) {
            await executor.run('ROLLBACK;');
            throw txErr;
          }
        } else {
          await sqliteService.runTransaction(action);
        }
      };

      await runInTx(async () => {
        // Langkah 1: Simpan Jurnal Pembalik
        await jrnRepo.create(reversalJournal);

        // Langkah 2: Pulihkan saldo COA yang terdampak oleh jurnal asal
        for (const entry of originalJournal.entries) {
          const acc = await accRepo.findById(entry.accountId);
          if (acc) {
            // Membalik efek jurnal asal: debit asal dikreditkan, kredit asal didebitkan
            const restoredBal = calculateNewBalance(acc.balance, acc.normalBalance, entry.credit, entry.debit);
            await accRepo.update(acc.id, { balance: restoredBal });
          }
        }

        // Langkah 3: Batalkan buku pembantu piutang/hutang transaksi asal jika ada
        if (origRec) {
          await exec.run(
            `UPDATE receivables SET status = 'Batal', outstanding = 0, updated_at = ? WHERE id = ?;`,
            [nowIso, origRec.id]
          );
        }
        if (origPay) {
          await exec.run(
            `UPDATE payables SET status = 'Batal', outstanding = 0, updated_at = ? WHERE id = ?;`,
            [nowIso, origPay.id]
          );
        }

        // Langkah 4: Kurangi akumulasi penjualan shift jika transaksi asal Penjualan pada shift aktif
        if (activeShift && originalTx.category === 'Penjualan') {
          await exec.run(
            `UPDATE shifts SET total_sales = total_sales - ?, updated_at = ? WHERE id = ?;`,
            [originalTx.total, nowIso, activeShift.id]
          );
          await exec.run(
            `UPDATE shift_sessions SET total_sales = total_sales - ?, updated_at = ? WHERE shift_id = ? AND status = 'Aktif';`,
            [originalTx.total, nowIso, activeShift.id]
          );
        }

        // Langkah 5: Simpan Transaksi Pengganti terlebih dahulu agar replacement_transaction_id valid di FK transaction_corrections
        await txRepo.create(finalReplacementTx);

        // Langkah 6: Simpan Audit Trail ke transaction_corrections
        // Disimpan sebelum transaksi asal diubah ke Batal agar trigger trg_transactions_prevent_cancel_if_posted mengizinkan pembatalan
        await corrRepo.create(correctionRecord);

        // Langkah 7: Tandai transaksi asal sebagai Batal dan Terkoreksi
        await exec.run(
          `UPDATE transactions SET
             status = 'Batal',
             is_corrected = 1,
             correction_id = ?,
             cancelled_at = ?,
             cancel_reason = ?,
             updated_at = ?
           WHERE id = ?;`,
          [correctionId, nowIso, reason.trim(), nowIso, originalTx.id]
        );

        // Langkah 8: Simpan Jurnal Pengganti
        await jrnRepo.create(replacementJournal);

        // Langkah 9: Mutasi Saldo Akun COA untuk Transaksi Pengganti
        const currentDebitAcc = await accRepo.findById(repDebitAccount.id);
        if (currentDebitAcc) {
          const newDebitBal = calculateNewBalance(currentDebitAcc.balance, currentDebitAcc.normalBalance, replacementData.total, 0);
          await accRepo.update(currentDebitAcc.id, { balance: newDebitBal });
        }
        const currentCreditAcc = await accRepo.findById(repCreditAccount.id);
        if (currentCreditAcc) {
          const newCreditBal = calculateNewBalance(currentCreditAcc.balance, currentCreditAcc.normalBalance, 0, replacementData.total);
          await accRepo.update(currentCreditAcc.id, { balance: newCreditBal });
        }

        // Langkah 10: Buat sub-ledger baru jika transaksi pengganti menggunakan Piutang / Hutang
        if (repMasterCode.paymentMethod === 'Piutang' || repDebitAccount.code === '1-1101') {
          const recId = `REC-${nowStamp}-${rand}`;
          await recRepo.create({
            id: recId,
            transactionId: replacementTxId,
            partnerId: repPartnerId || 'CUS-001',
            partnerName: replacementData.partnerName || 'Pelanggan',
            amount: replacementData.total,
            outstanding: replacementData.total,
            status: 'Open',
            date: (replacementData.date || originalTx.date).slice(0, 10),
            notes: `${replacementData.name} (${replacementData.code})`
          });
        } else if (repMasterCode.paymentMethod === 'Hutang' || repCreditAccount.code === '2-1001') {
          const payId = `PAY-${nowStamp}-${rand}`;
          await payRepo.create({
            id: payId,
            transactionId: replacementTxId,
            partnerId: repPartnerId || 'VEN-001',
            partnerName: replacementData.partnerName || 'Vendor',
            amount: replacementData.total,
            outstanding: replacementData.total,
            status: 'Open',
            date: (replacementData.date || originalTx.date).slice(0, 10),
            notes: `${replacementData.name} (${replacementData.code})`
          });
        }

        // Langkah 11: Tambahkan akumulasi penjualan shift jika transaksi pengganti Penjualan pada shift aktif
        if (activeShift && replacementData.category === 'Penjualan') {
          await exec.run(
            `UPDATE shifts SET total_sales = total_sales + ?, updated_at = ? WHERE id = ?;`,
            [replacementData.total, nowIso, activeShift.id]
          );
          await exec.run(
            `UPDATE shift_sessions SET total_sales = total_sales + ?, updated_at = ? WHERE shift_id = ? AND status = 'Aktif';`,
            [replacementData.total, nowIso, activeShift.id]
          );
        }
      });

      // Ambil snapshot terupdate untuk sinkronisasi state React
      const [updatedAccounts, updatedReceivables, updatedPayables, updatedShifts] = await Promise.all([
        accRepo.findAll(),
        recRepo.findAll(),
        payRepo.findAll(),
        shiftRepo.getAllShifts()
      ]);

      const updatedOriginal = await txRepo.findById(originalTx.id);

      return {
        success: true,
        originalTransaction: updatedOriginal || originalTx,
        reversalJournal,
        replacementTransaction: finalReplacementTx,
        replacementJournal,
        correction: correctionRecord,
        updatedAccounts,
        updatedReceivables,
        updatedPayables,
        updatedShifts
      };
    } catch (err: any) {
      console.error('[AccountingService] Gagal mengeksekusi koreksi transaksi:', err);
      return {
        success: false,
        error: err?.message || String(err)
      };
    }
  }
}

export const accountingService = AccountingService;
