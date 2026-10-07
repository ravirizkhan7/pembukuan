/**
 * ACCOUNTING POSTING ENGINE
 * Layanan terpusat untuk memposting transaksi ke jurnal umum,
 * menghitung mutasi saldo akun (COA) berdasarkan normalBalance,
 * serta memperbarui buku pembantu Piutang (Receivables) dan Hutang (Payables).
 */

import {
  Transaction,
  MasterCode,
  Account,
  Journal,
  JournalEntry,
  BusinessPartner,
  Receivable,
  Payable
} from '../types';

export interface PostingResult {
  success: boolean;
  error?: string;
  journal?: Journal;
  updatedAccounts: Account[];
  updatedReceivables: Receivable[];
  updatedPayables: Payable[];
}

/**
 * Menghitung saldo akun baru sesuai kaidah Akuntansi Akrual:
 * - Akun bertipe Normal Debit (Aset, Beban Pokok, Beban):
 *   Debit menambah saldo (+), Kredit mengurangi saldo (-).
 * - Akun bertipe Normal Kredit (Kewajiban, Ekuitas, Pendapatan):
 *   Kredit menambah saldo (+), Debit mengurangi saldo (-).
 */
export function calculateNewBalance(
  currentBalance: number,
  normalBalance: 'Debit' | 'Kredit',
  debitAmount: number,
  creditAmount: number
): number {
  if (normalBalance === 'Debit') {
    return currentBalance + debitAmount - creditAmount;
  } else {
    return currentBalance + creditAmount - debitAmount;
  }
}

/**
 * Memproses posting transaksi secara atomik dan terstruktur:
 * 1. Menemukan MasterCode dan memvalidasi kelengkapan akun Debit & Kredit
 * 2. Membuat dokumen Jurnal Umum dua sisi seimbang (Double Entry)
 * 3. Memperbarui Account.balance sesuai normalBalance masing-masing akun
 * 4. Mengelola siklus Piutang (Penjualan Kredit -> Open, Pelunasan -> Partial / Paid)
 * 5. Mengelola siklus Hutang (Pembelian Kredit -> Open, Pembayaran -> Partial / Paid)
 */
export function postTransaction(params: {
  transaction: Transaction;
  masterCodes: MasterCode[];
  accounts: Account[];
  businessPartners: BusinessPartner[];
  receivables: Receivable[];
  payables: Payable[];
}): PostingResult {
  const { transaction, masterCodes, accounts, businessPartners, receivables, payables } = params;

  // 1. Validasi Keberadaan Master Code
  const masterCode = masterCodes.find(
    (mc) => mc.id === transaction.masterCodeId || mc.code === transaction.code
  );

  if (!masterCode) {
    return {
      success: false,
      error: `Master Code "${transaction.code}" tidak ditemukan dalam sistem.`,
      updatedAccounts: accounts,
      updatedReceivables: receivables,
      updatedPayables: payables
    };
  }

  if (transaction.total <= 0) {
    return {
      success: false,
      error: 'Nominal transaksi harus lebih besar dari 0.',
      updatedAccounts: accounts,
      updatedReceivables: receivables,
      updatedPayables: payables
    };
  }

  // 2. Validasi Akun Debit dan Kredit
  const debitAccount = accounts.find((a) => a.id === masterCode.debitAccountId || a.code === masterCode.debitAccountId);
  const creditAccount = accounts.find((a) => a.id === masterCode.creditAccountId || a.code === masterCode.creditAccountId);

  if (!debitAccount) {
    return {
      success: false,
      error: `Akun Debit [${masterCode.debitAccountId}] tidak ditemukan di Bagan Akun (COA).`,
      updatedAccounts: accounts,
      updatedReceivables: receivables,
      updatedPayables: payables
    };
  }

  if (!creditAccount) {
    return {
      success: false,
      error: `Akun Kredit [${masterCode.creditAccountId}] tidak ditemukan di Bagan Akun (COA).`,
      updatedAccounts: accounts,
      updatedReceivables: receivables,
      updatedPayables: payables
    };
  }

  // Resolve Business Partner jika tersedia
  const partner = businessPartners.find(
    (bp) => bp.id === transaction.partnerId || bp.name === transaction.partnerName
  );
  const partnerName = partner ? partner.name : (transaction.partnerName || 'Pihak Ketiga');

  let currentReceivables = [...receivables];
  let currentPayables = [...payables];

  // 3. Logic Siklus Piutang Usaha
  // A. Penjualan Kredit (Menambah Piutang & Buat Buku Pembantu Receivable)
  if (masterCode.paymentMethod === 'Piutang' || debitAccount.code === '1-1101') {
    const newReceivable: Receivable = {
      id: `REC-${Date.now().toString().slice(-6)}`,
      transactionId: transaction.id,
      partnerId: partner ? partner.id : 'CUS-001',
      partnerName: partnerName,
      amount: transaction.total,
      outstanding: transaction.total,
      status: 'Open',
      date: transaction.date.slice(0, 10),
      notes: `${transaction.name} (${transaction.code})`
    };
    currentReceivables = [newReceivable, ...currentReceivables];
  }

  // B. Pelunasan Piutang (Mengurangi Piutang)
  if (masterCode.category === 'Pelunasan' && creditAccount.code === '1-1101') {
    if (!transaction.relatedReceivableId) {
      return {
        success: false,
        error: 'Transaksi pelunasan piutang wajib memilih faktur/tagihan piutang terkait (relatedReceivableId).',
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const targetIdx = currentReceivables.findIndex(
      (r) => r.id === transaction.relatedReceivableId
    );

    if (targetIdx === -1) {
      return {
        success: false,
        error: `Faktur piutang dengan ID "${transaction.relatedReceivableId}" tidak ditemukan.`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const targetRec = currentReceivables[targetIdx];

    if (targetRec.status === 'Paid') {
      return {
        success: false,
        error: `Faktur piutang "${targetRec.id}" sudah berstatus lunas (Paid).`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    if (transaction.partnerId && targetRec.partnerId && transaction.partnerId !== targetRec.partnerId) {
      return {
        success: false,
        error: `Faktur piutang "${targetRec.id}" milik mitra ${targetRec.partnerName}, tidak sesuai dengan mitra transaksi (${partnerName}).`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const newOutstanding = targetRec.outstanding - transaction.total;

    if (newOutstanding < 0) {
      return {
        success: false,
        error: `Nominal pelunasan (Rp ${transaction.total.toLocaleString('id-ID')}) melebihi sisa piutang (Rp ${targetRec.outstanding.toLocaleString('id-ID')}). Outstanding negatif tidak diperbolehkan.`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const updatedRec: Receivable = {
      ...targetRec,
      outstanding: newOutstanding,
      status: newOutstanding === 0 ? 'Paid' : 'Partial'
    };

    currentReceivables[targetIdx] = updatedRec;
  }

  // 4. Logic Siklus Hutang Usaha
  // A. Pembelian Kredit (Menambah Hutang & Buat Buku Pembantu Payable)
  if (masterCode.paymentMethod === 'Hutang' || creditAccount.code === '2-1001') {
    const newPayable: Payable = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      transactionId: transaction.id,
      partnerId: partner ? partner.id : 'VEN-001',
      partnerName: partnerName,
      amount: transaction.total,
      outstanding: transaction.total,
      status: 'Open',
      date: transaction.date.slice(0, 10),
      notes: `${transaction.name} (${transaction.code})`
    };
    currentPayables = [newPayable, ...currentPayables];
  }

  // B. Pembayaran Hutang Usaha (Mengurangi Hutang)
  if (masterCode.category === 'Pelunasan' && debitAccount.code === '2-1001') {
    if (!transaction.relatedPayableId) {
      return {
        success: false,
        error: 'Transaksi pembayaran hutang wajib memilih tagihan hutang terkait (relatedPayableId).',
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const targetIdx = currentPayables.findIndex(
      (p) => p.id === transaction.relatedPayableId
    );

    if (targetIdx === -1) {
      return {
        success: false,
        error: `Tagihan hutang dengan ID "${transaction.relatedPayableId}" tidak ditemukan.`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const targetPay = currentPayables[targetIdx];

    if (targetPay.status === 'Paid') {
      return {
        success: false,
        error: `Tagihan hutang "${targetPay.id}" sudah berstatus lunas (Paid).`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    if (transaction.partnerId && targetPay.partnerId && transaction.partnerId !== targetPay.partnerId) {
      return {
        success: false,
        error: `Tagihan hutang "${targetPay.id}" milik vendor ${targetPay.partnerName}, tidak sesuai dengan vendor transaksi (${partnerName}).`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const newOutstanding = targetPay.outstanding - transaction.total;

    if (newOutstanding < 0) {
      return {
        success: false,
        error: `Nominal pembayaran (Rp ${transaction.total.toLocaleString('id-ID')}) melebihi sisa hutang (Rp ${targetPay.outstanding.toLocaleString('id-ID')}). Outstanding negatif tidak diperbolehkan.`,
        updatedAccounts: accounts,
        updatedReceivables: receivables,
        updatedPayables: payables
      };
    }

    const updatedPay: Payable = {
      ...targetPay,
      outstanding: newOutstanding,
      status: newOutstanding === 0 ? 'Paid' : 'Partial'
    };

    currentPayables[targetIdx] = updatedPay;
  }

  // 5. Pembuatan Dokumen Jurnal Umum Berpasangan (Double Entry)
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

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const isBalanced = totalDebit === totalCredit;

  const journal: Journal = {
    id: `JRN-${Date.now().toString().slice(-6)}`,
    date: transaction.date.slice(0, 10),
    transactionId: transaction.id,
    evidenceNo: `BKT/${transaction.date.slice(0, 10).replace(/-/g, '')}/${transaction.id.slice(-3)}`,
    transCode: transaction.code,
    description: transaction.name,
    entries,
    isBalanced
  };

  // 6. Mutasi Saldo Akun (COA Posting)
  const updatedAccounts = accounts.map((acc) => {
    if (acc.id === debitAccount.id) {
      const newBal = calculateNewBalance(acc.balance, acc.normalBalance, transaction.total, 0);
      return { ...acc, balance: newBal };
    }
    if (acc.id === creditAccount.id) {
      const newBal = calculateNewBalance(acc.balance, acc.normalBalance, 0, transaction.total);
      return { ...acc, balance: newBal };
    }
    return acc;
  });

  return {
    success: true,
    journal,
    updatedAccounts,
    updatedReceivables: currentReceivables,
    updatedPayables: currentPayables
  };
}
