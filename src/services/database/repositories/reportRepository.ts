import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type {
  ReportsData,
  NeracaKonsolidasi,
  NeracaRow,
  LabaRugiKonsolidasi,
  LabaRugiRow,
  FinancialItem,
  StockReportItem,
  StationInfo,
  SalesAndShiftRecap,
  ShiftSalesItem,
  PaymentMethodSalesSummary
} from '../../../types';

/**
 * Helper untuk mengurai parameter periode menjadi rentang tanggal (ISO YYYY-MM-DD)
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PeriodFilterResult {
  startDate?: string;
  endDate?: string;
  label: string;
}

/**
 * Helper untuk mengurai parameter periode menjadi rentang tanggal (ISO YYYY-MM-DD)
 * Menjamin parsing zona waktu lokal, bebas dari off-by-one UTC error.
 */
export function parsePeriodFilter(
  period?: string | { startDate?: string; endDate?: string; label?: string }
): PeriodFilterResult {
  if (!period) {
    return { label: 'Semua Periode' };
  }

  // Jika input berupa objek rentang tanggal
  if (typeof period === 'object') {
    const start = period.startDate?.trim();
    const end = period.endDate?.trim();
    if (start && end && start > end) {
      throw new Error(`Tanggal mulai (${start}) tidak boleh melewati tanggal akhir (${end}).`);
    }
    return {
      startDate: start || undefined,
      endDate: end || undefined,
      label: period.label || (start && end ? `${start} s/d ${end}` : 'Semua Periode')
    };
  }

  const clean = period.trim();
  if (clean === '' || clean === 'Semua Periode' || clean === 'Semua') {
    return { label: 'Semua Periode' };
  }

  const now = new Date();
  const today = formatLocalDate(now);

  // 1. Hari Ini — dari awal sampai akhir hari ini
  if (clean === 'Hari Ini') {
    return { startDate: today, endDate: today, label: 'Hari Ini' };
  }

  // 2. 7 Hari Terakhir — tujuh hari kalender termasuk hari ini (hari ini + 6 hari kalender sebelumnya)
  if (clean === '7 Hari Terakhir') {
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { startDate: formatLocalDate(sevenDaysAgo), endDate: today, label: '7 Hari Terakhir' };
  }

  // 3. Bulan Ini — tanggal 1 bulan berjalan sampai hari ini
  if (clean === 'Bulan Ini') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatLocalDate(firstDay), endDate: today, label: 'Bulan Ini' };
  }

  // 4. Tahun Ini — 1 Januari tahun berjalan sampai hari ini
  if (clean === 'Tahun Ini') {
    const firstDayYear = new Date(now.getFullYear(), 0, 1);
    return { startDate: formatLocalDate(firstDayYear), endDate: today, label: 'Tahun Ini' };
  }

  // 5. Custom / Rentang Tanggal Kustom tanpa rentang eksplisit
  if (clean === 'Custom' || clean === 'Rentang Tanggal Kustom') {
    return { startDate: today, endDate: today, label: 'Custom' };
  }

  // 6. Format Prefix Custom (mis. "Custom:2026-10-01:2026-10-15" atau "Kustom:2026-10-01:2026-10-15")
  if (clean.startsWith('Custom:') || clean.startsWith('Kustom:')) {
    const parts = clean.split(':');
    const start = parts[1]?.trim();
    const end = parts[2]?.trim();
    if (start && end && start > end) {
      throw new Error(`Tanggal mulai (${start}) tidak boleh melewati tanggal akhir (${end}).`);
    }
    return {
      startDate: start || undefined,
      endDate: end || undefined,
      label: start && end ? `${start} s/d ${end}` : 'Custom'
    };
  }

  // 9. Format Rentang "YYYY-MM-DD s/d YYYY-MM-DD" atau "YYYY-MM-DD - YYYY-MM-DD"
  const rangeMatch = clean.match(/^(\d{4}-\d{2}-\d{2})\s*(?:s\/d|-)\s*(\d{4}-\d{2}-\d{2})$/i);
  if (rangeMatch) {
    const start = rangeMatch[1];
    const end = rangeMatch[2];
    if (start > end) {
      throw new Error(`Tanggal mulai (${start}) tidak boleh melewati tanggal akhir (${end}).`);
    }
    return { startDate: start, endDate: end, label: `${start} s/d ${end}` };
  }

  // Legacy format (Agustus 2026, September 2026, Juli 2026, Tahun 2026)
  if (clean.includes('31-Aug-2026') || clean.includes('Agustus 2026')) {
    return { startDate: '2026-08-01', endDate: '2026-08-31', label: '31 Agustus 2026' };
  }
  if (clean.includes('September 2026')) {
    return { startDate: '2026-09-01', endDate: '2026-09-30', label: '30 September 2026' };
  }
  if (clean.includes('Juli 2026')) {
    return { startDate: '2026-07-01', endDate: '2026-07-31', label: '31 Juli 2026' };
  }
  if (clean.includes('Tahun 2026')) {
    return { startDate: '2026-01-01', endDate: '2026-12-31', label: 'Tahun 2026' };
  }

  // YYYY-MM-DD (Single day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { startDate: clean, endDate: clean, label: clean };
  }

  // YYYY-MM (Single month)
  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [y, m] = clean.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { startDate: `${clean}-01`, endDate: `${clean}-${String(lastDay).padStart(2, '0')}`, label: clean };
  }

  return { label: clean };
}

/**
 * REPOSITORY: LAPORAN KEUANGAN & OPERASIONAL SQLITE (PHASE 10)
 * 
 * Mengagregasi data aktual dari jurnal umum, detail entri, akun COA, transaksi,
 * tanki, dan sesi shift ke format laporan standar:
 * 1. Neraca Konsolidasi (Balance Sheet)
 * 2. Laba Rugi Konsolidasi & Sederhana (Income Statement)
 * 3. Laporan Arus Kas (Cash Flow Statement)
 * 4. Persediaan Stok & Penjualan BBM
 * 5. Rekapitulasi Penjualan & Sesi Shift
 */
export class ReportRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  /**
   * Mengambil Laporan Neraca Konsolidasi Harian berbasis Jurnal SQLite
   */
  public async getNeraca(period?: string, stationInfo?: StationInfo): Promise<NeracaKonsolidasi> {
    const { startDate, endDate, label } = parsePeriodFilter(period);

    try {
      // 1. Ambil saldo awal (jika rentang tanggal ditentukan)
      const saldoAwalMap = new Map<string, number>();
      if (startDate) {
        const saldoAwalRows = await this.executor.query<any>(
          `SELECT a.id,
                  COALESCE(sub.saldo_awal, 0) AS saldo_awal
           FROM accounts a
           LEFT JOIN (
             SELECT je.account_id,
                    SUM(CASE WHEN a2.normal_balance = 'Debit' THEN je.debit - je.credit ELSE je.credit - je.debit END) AS saldo_awal
             FROM journal_entries je
             JOIN journals j ON je.journal_id = j.id AND substr(j.date, 1, 10) < ?
             JOIN accounts a2 ON je.account_id = a2.id
             GROUP BY je.account_id
           ) sub ON a.id = sub.account_id;`,
          [startDate]
        );
        for (const row of saldoAwalRows) {
          saldoAwalMap.set(row.id, Number(row.saldo_awal || 0));
        }
      }

      // 2. Ambil mutasi dalam periode
      let mutasiDateFilter = '';
      const mutasiParams: any[] = [];
      if (startDate && endDate) {
        mutasiDateFilter = ` WHERE substr(j.date, 1, 10) >= ? AND substr(j.date, 1, 10) <= ? `;
        mutasiParams.push(startDate, endDate);
      }

      const mutasiSql = `
        SELECT a.id, a.code, a.name, a.category, a.normal_balance, a.balance AS stored_balance,
               COALESCE(sub.debet, 0) AS debet,
               COALESCE(sub.kredit, 0) AS kredit
        FROM accounts a
        LEFT JOIN (
          SELECT je.account_id,
                 SUM(je.debit) AS debet,
                 SUM(je.credit) AS kredit
          FROM journal_entries je
          JOIN journals j ON je.journal_id = j.id
          ${mutasiDateFilter}
          GROUP BY je.account_id
        ) sub ON a.id = sub.account_id
        WHERE a.is_active = 1
        ORDER BY a.code ASC;
      `;

      const rows = await this.executor.query<any>(mutasiSql, mutasiParams);

      // Kelompokkan baris berdasarkan Section Neraca
      const asetRows: NeracaRow[] = [];
      const kewajibanRows: NeracaRow[] = [];
      const ekuitasRows: NeracaRow[] = [];

      let totalAsetAwal = 0, totalAsetDebet = 0, totalAsetKredit = 0, totalAsetAkhir = 0;
      let totalKewajibanAwal = 0, totalKewajibanDebet = 0, totalKewajibanKredit = 0, totalKewajibanAkhir = 0;
      let totalEkuitasAwal = 0, totalEkuitasDebet = 0, totalEkuitasKredit = 0, totalEkuitasAkhir = 0;

      let totalRevAwal = 0, totalRevDebet = 0, totalRevKredit = 0;
      let totalExpAwal = 0, totalExpDebet = 0, totalExpKredit = 0;

      // Pemeriksaan rekonsiliasi saldo akun (stored vs mutasi jurnal kumulatif)
      const accountDiscrepancies: Array<{
        accountCode: string;
        accountName: string;
        storedBalance: number;
        journalBalance: number;
        selisih: number;
      }> = [];

      for (const row of rows) {
        const id = row.id;
        const code = row.code;
        const name = row.name;
        const category = row.category;
        const normal = row.normal_balance as 'Debit' | 'Kredit';
        const debet = Number(row.debet || 0);
        const kredit = Number(row.kredit || 0);
        const storedBal = Number(row.stored_balance || 0);
        const saldoAwal = saldoAwalMap.get(id) || 0;

        const saldoAkhir = normal === 'Debit'
          ? saldoAwal + debet - kredit
          : saldoAwal + kredit - debet;

        // Jika audit seumur hidup (tanpa filter rentang awal), bandingkan stored_balance vs journal saldoAkhir
        if (!startDate && Math.abs(storedBal - saldoAkhir) > 0.001) {
          accountDiscrepancies.push({
            accountCode: code,
            accountName: name,
            storedBalance: storedBal,
            journalBalance: saldoAkhir,
            selisih: saldoAkhir - storedBal
          });
        }

        if (category === 'Aset') {
          totalAsetAwal += saldoAwal;
          totalAsetDebet += debet;
          totalAsetKredit += kredit;
          totalAsetAkhir += saldoAkhir;

          asetRows.push({
            code,
            name,
            section: 'ASET',
            level: 2,
            saldoAwal,
            debet,
            kredit,
            saldoAkhir
          });
        } else if (category === 'Kewajiban') {
          totalKewajibanAwal += saldoAwal;
          totalKewajibanDebet += debet;
          totalKewajibanKredit += kredit;
          totalKewajibanAkhir += saldoAkhir;

          kewajibanRows.push({
            code,
            name,
            section: 'KEWAJIBAN',
            level: 2,
            saldoAwal,
            debet,
            kredit,
            saldoAkhir
          });
        } else if (category === 'Ekuitas') {
          totalEkuitasAwal += saldoAwal;
          totalEkuitasDebet += debet;
          totalEkuitasKredit += kredit;
          totalEkuitasAkhir += saldoAkhir;

          ekuitasRows.push({
            code,
            name,
            section: 'EKUITAS',
            level: 2,
            saldoAwal,
            debet,
            kredit,
            saldoAkhir
          });
        } else if (category === 'Pendapatan') {
          totalRevAwal += saldoAwal;
          totalRevDebet += debet;
          totalRevKredit += kredit;
        } else if (category === 'Beban' || category === 'Beban Pokok') {
          totalExpAwal += saldoAwal;
          totalExpDebet += debet;
          totalExpKredit += kredit;
        }
      }

      // Hitung Laba (Rugi) Periode Berjalan murni dari Pendapatan & Beban (Revenues - Expenses)
      // BUKAN angka penyeimbang buatan!
      const labaAwal = totalRevAwal - totalExpAwal;
      const labaDebet = totalExpDebet;
      const labaKredit = totalRevKredit;
      const labaPeriodeAkhir = (totalRevAwal + (totalRevKredit - totalRevDebet)) - (totalExpAwal + (totalExpDebet - totalExpKredit));

      ekuitasRows.push({
        code: '-',
        name: 'Laba (Rugi) Periode Berjalan',
        section: 'EKUITAS',
        level: 2,
        saldoAwal: labaAwal,
        debet: labaDebet,
        kredit: labaKredit,
        saldoAkhir: labaPeriodeAkhir
      });

      const totalEkuitasPlusLabaAwal = totalEkuitasAwal + labaAwal;
      const totalEkuitasPlusLabaDebet = totalEkuitasDebet + labaDebet;
      const totalEkuitasPlusLabaKredit = totalEkuitasKredit + labaKredit;
      const totalEkuitasPlusLabaAkhir = totalEkuitasAkhir + labaPeriodeAkhir;

      const grandTotalPasivaAwal = totalKewajibanAwal + totalEkuitasPlusLabaAwal;
      const grandTotalPasivaDebet = totalKewajibanDebet + totalEkuitasPlusLabaDebet;
      const grandTotalPasivaKredit = totalKewajibanKredit + totalEkuitasPlusLabaKredit;
      const grandTotalPasivaAkhir = totalKewajibanAkhir + totalEkuitasPlusLabaAkhir;

      // Evaluasi Keseimbangan Neraca (Total Aset vs Total Pasiva)
      // Jangan pernah memaksa total aset sama dengan total kewajiban dan ekuitas!
      const selisihAwal = totalAsetAwal - grandTotalPasivaAwal;
      const selisihDebet = totalAsetDebet - grandTotalPasivaDebet;
      const selisihKredit = totalAsetKredit - grandTotalPasivaKredit;
      const selisihAkhir = totalAsetAkhir - grandTotalPasivaAkhir;
      const isSeimbang = Math.abs(selisihAkhir) === 0;

      // Periksa integritas jurnal umum (apakah ada jurnal dengan total debit != total credit)
      const unbalancedJournalRows = await this.executor.query<any>(
        `SELECT j.id, j.trans_code, j.description, j.is_balanced,
                COALESCE(SUM(je.debit), 0) AS total_debit,
                COALESCE(SUM(je.credit), 0) AS total_credit
         FROM journals j
         LEFT JOIN journal_entries je ON j.id = je.journal_id
         GROUP BY j.id
         HAVING total_debit != total_credit OR j.is_balanced = 0;`
      );

      const unbalancedJournals = unbalancedJournalRows.map((uj: any) => ({
        id: uj.id,
        transCode: uj.trans_code || undefined,
        description: uj.description || '',
        totalDebit: Number(uj.total_debit || 0),
        totalCredit: Number(uj.total_credit || 0),
        selisih: Number(uj.total_debit || 0) - Number(uj.total_credit || 0)
      }));

      // Bentuk baris laporan terstruktur
      const finalRows: NeracaRow[] = [];

      // 1. Header Aset
      finalRows.push({
        name: '1. ASET',
        section: 'ASET',
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      });
      finalRows.push(...asetRows);
      finalRows.push({
        name: 'JUMLAH ASET',
        section: 'ASET',
        level: 1,
        isSubtotal: true,
        saldoAwal: totalAsetAwal,
        debet: totalAsetDebet,
        kredit: totalAsetKredit,
        saldoAkhir: totalAsetAkhir
      });

      // 2. Header Kewajiban
      finalRows.push({
        name: '2. KEWAJIBAN',
        section: 'KEWAJIBAN',
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      });
      finalRows.push(...kewajibanRows);
      finalRows.push({
        name: 'JUMLAH KEWAJIBAN',
        section: 'KEWAJIBAN',
        level: 1,
        isSubtotal: true,
        saldoAwal: totalKewajibanAwal,
        debet: totalKewajibanDebet,
        kredit: totalKewajibanKredit,
        saldoAkhir: totalKewajibanAkhir
      });

      // 3. Header Ekuitas
      finalRows.push({
        name: '3. EKUITAS',
        section: 'EKUITAS',
        level: 1,
        isSectionHeader: true,
        saldoAwal: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0
      });
      finalRows.push(...ekuitasRows);
      finalRows.push({
        name: 'JUMLAH EKUITAS',
        section: 'EKUITAS',
        level: 1,
        isSubtotal: true,
        saldoAwal: totalEkuitasPlusLabaAwal,
        debet: totalEkuitasPlusLabaDebet,
        kredit: totalEkuitasPlusLabaKredit,
        saldoAkhir: totalEkuitasPlusLabaAkhir
      });

      // 4. Grand Total Pasiva (Kewajiban + Ekuitas)
      finalRows.push({
        name: 'TOTAL KEWAJIBAN & EKUITAS',
        section: 'TOTAL',
        level: 1,
        isGrandTotal: true,
        saldoAwal: grandTotalPasivaAwal,
        debet: grandTotalPasivaDebet,
        kredit: grandTotalPasivaKredit,
        saldoAkhir: grandTotalPasivaAkhir
      });

      // 5. Baris Pemeriksaan Keseimbangan (Audit Keseimbangan Aktiva vs Pasiva)
      finalRows.push({
        name: isSeimbang
          ? 'STATUS PEMERIKSAAN KESEIMBANGAN: SEIMBANG (0)'
          : `STATUS PEMERIKSAAN KESEIMBANGAN: TIDAK SEIMBANG (SELISIH ${selisihAkhir > 0 ? '+' : ''}${selisihAkhir.toLocaleString('id-ID')})`,
        section: 'TOTAL',
        level: 1,
        isGrandTotal: true,
        saldoAwal: selisihAwal,
        debet: Math.abs(selisihDebet),
        kredit: Math.abs(selisihKredit),
        saldoAkhir: selisihAkhir
      });

      return {
        title: 'LAPORAN NERACA HARIAN KONSOLIDASI',
        periodDate: label,
        entityName: stationInfo?.name || 'PT SPBU Mitra Akrual 1954',
        location: stationInfo?.address || 'Lubuk Alung',
        signerDate: new Date().toLocaleDateString('id-ID'),
        totalAset: totalAsetAkhir,
        totalKewajibanDanEkuitas: grandTotalPasivaAkhir,
        selisihKeseimbangan: selisihAkhir,
        isSeimbang: isSeimbang,
        hasAccountBalanceDiscrepancy: accountDiscrepancies.length > 0,
        accountDiscrepancies: accountDiscrepancies,
        unbalancedJournals: unbalancedJournals,
        rows: finalRows
      };
    } catch (err) {
      return this.handleDbError(err, 'Gagal menyusun Laporan Neraca dari SQLite');
    }
  }

  /**
   * Mengambil Laporan Laba Rugi (Konsolidasi & Sederhana)
   */
  public async getLabaRugi(period?: string, stationInfo?: StationInfo): Promise<{
    simple: ReportsData['labaRugi'];
    konsolidasi: LabaRugiKonsolidasi;
  }> {
    const { startDate, endDate, label } = parsePeriodFilter(period);

    try {
      // Saldo kemarin / saldo awal
      const saldoKemarinMap = new Map<string, number>();
      if (startDate) {
        const saldoAwalRows = await this.executor.query<any>(
          `SELECT a.id,
                  COALESCE(sub.saldo_awal, 0) AS saldo_awal
           FROM accounts a
           LEFT JOIN (
             SELECT je.account_id,
                    SUM(CASE WHEN a2.normal_balance = 'Debit' THEN je.debit - je.credit ELSE je.credit - je.debit END) AS saldo_awal
             FROM journal_entries je
             JOIN journals j ON je.journal_id = j.id AND substr(j.date, 1, 10) < ?
             JOIN accounts a2 ON je.account_id = a2.id
             GROUP BY je.account_id
           ) sub ON a.id = sub.account_id
           WHERE a.category IN ('Pendapatan', 'Beban Pokok', 'Beban');`,
          [startDate]
        );
        for (const row of saldoAwalRows) {
          saldoKemarinMap.set(row.id, Number(row.saldo_awal || 0));
        }
      }

      // Mutasi pendapatan & beban periode berjalan
      let mutasiDateFilter = '';
      const mutasiParams: any[] = [];
      if (startDate && endDate) {
        mutasiDateFilter = ` WHERE substr(j.date, 1, 10) >= ? AND substr(j.date, 1, 10) <= ? `;
        mutasiParams.push(startDate, endDate);
      }

      const mutasiSql = `
        SELECT a.id, a.code, a.name, a.category, a.normal_balance,
               COALESCE(sub.debet, 0) AS debet,
               COALESCE(sub.kredit, 0) AS kredit
        FROM accounts a
        LEFT JOIN (
          SELECT je.account_id,
                 SUM(je.debit) AS debet,
                 SUM(je.credit) AS kredit
          FROM journal_entries je
          JOIN journals j ON je.journal_id = j.id
          ${mutasiDateFilter}
          GROUP BY je.account_id
        ) sub ON a.id = sub.account_id
        WHERE a.category IN ('Pendapatan', 'Beban Pokok', 'Beban') AND a.is_active = 1
        ORDER BY a.code ASC;
      `;

      const rows = await this.executor.query<any>(mutasiSql, mutasiParams);

      const revenues: FinancialItem[] = [];
      const cogs: FinancialItem[] = [];
      const operationalExpenses: FinancialItem[] = [];

      const pendapatanRows: LabaRugiRow[] = [];
      const hppRows: LabaRugiRow[] = [];
      const bebanRows: LabaRugiRow[] = [];

      let totalPendapatanKemarin = 0, totalPendapatanDebet = 0, totalPendapatanKredit = 0, totalPendapatanAkhir = 0;
      let totalHppKemarin = 0, totalHppDebet = 0, totalHppKredit = 0, totalHppAkhir = 0;
      let totalBebanKemarin = 0, totalBebanDebet = 0, totalBebanKredit = 0, totalBebanAkhir = 0;

      for (const row of rows) {
        const id = row.id;
        const code = row.code;
        const name = row.name;
        const category = row.category;
        const debet = Number(row.debet || 0);
        const kredit = Number(row.kredit || 0);
        const saldoKemarin = saldoKemarinMap.get(id) || 0;

        if (category === 'Pendapatan') {
          const saldoAkhir = saldoKemarin + kredit - debet;
          const mutasiPeriode = kredit - debet;
          totalPendapatanKemarin += saldoKemarin;
          totalPendapatanDebet += debet;
          totalPendapatanKredit += kredit;
          totalPendapatanAkhir += saldoAkhir;

          revenues.push({ name, amount: startDate ? mutasiPeriode : saldoAkhir });
          pendapatanRows.push({
            code,
            name,
            level: 2,
            saldoKemarin,
            debet,
            kredit,
            saldoAkhir
          });
        } else if (category === 'Beban Pokok') {
          const saldoAkhir = saldoKemarin + debet - kredit;
          const mutasiPeriode = debet - kredit;
          totalHppKemarin += saldoKemarin;
          totalHppDebet += debet;
          totalHppKredit += kredit;
          totalHppAkhir += saldoAkhir;

          cogs.push({ name, amount: startDate ? mutasiPeriode : saldoAkhir });
          hppRows.push({
            code,
            name,
            level: 2,
            saldoKemarin,
            debet,
            kredit,
            saldoAkhir
          });
        } else if (category === 'Beban') {
          const saldoAkhir = saldoKemarin + debet - kredit;
          const mutasiPeriode = debet - kredit;
          totalBebanKemarin += saldoKemarin;
          totalBebanDebet += debet;
          totalBebanKredit += kredit;
          totalBebanAkhir += saldoAkhir;

          operationalExpenses.push({ name, amount: startDate ? mutasiPeriode : saldoAkhir });
          bebanRows.push({
            code,
            name,
            level: 2,
            saldoKemarin,
            debet,
            kredit,
            saldoAkhir
          });
        }
      }

      const labaKotorKemarin = totalPendapatanKemarin - totalHppKemarin;
      const labaKotorDebet = totalHppDebet;
      const labaKotorKredit = totalPendapatanKredit;
      const labaKotorAkhir = totalPendapatanAkhir - totalHppAkhir;

      const labaBersihKemarin = labaKotorKemarin - totalBebanKemarin;
      const labaBersihDebet = totalHppDebet + totalBebanDebet;
      const labaBersihKredit = totalPendapatanKredit;
      const labaBersihAkhir = labaKotorAkhir - totalBebanAkhir;

      const konsolidasiRows: LabaRugiRow[] = [];

      // 1. Pendapatan
      konsolidasiRows.push({
        code: '',
        name: '1. PENDAPATAN OPERASIONAL',
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      });
      konsolidasiRows.push(...pendapatanRows);
      konsolidasiRows.push({
        code: '',
        name: 'JUMLAH PENDAPATAN OPERASIONAL',
        level: 1,
        saldoKemarin: totalPendapatanKemarin,
        debet: totalPendapatanDebet,
        kredit: totalPendapatanKredit,
        saldoAkhir: totalPendapatanAkhir,
        isTotal: true
      });

      // 2. Beban Pokok (HPP)
      konsolidasiRows.push({
        code: '',
        name: '2. BEBAN POKOK PENJUALAN (HPP)',
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      });
      konsolidasiRows.push(...hppRows);
      konsolidasiRows.push({
        code: '',
        name: 'JUMLAH BEBAN POKOK PENJUALAN',
        level: 1,
        saldoKemarin: totalHppKemarin,
        debet: totalHppDebet,
        kredit: totalHppKredit,
        saldoAkhir: totalHppAkhir,
        isTotal: true
      });

      // Subtotal Laba Kotor
      konsolidasiRows.push({
        code: '',
        name: 'LABA KOTOR OPERASIONAL',
        level: 1,
        saldoKemarin: labaKotorKemarin,
        debet: labaKotorDebet,
        kredit: labaKotorKredit,
        saldoAkhir: labaKotorAkhir,
        isTotal: true
      });

      // 3. Beban Operasional
      konsolidasiRows.push({
        code: '',
        name: '3. BEBAN OPERASIONAL',
        level: 1,
        saldoKemarin: 0,
        debet: 0,
        kredit: 0,
        saldoAkhir: 0,
        isSectionHeader: true
      });
      konsolidasiRows.push(...bebanRows);
      konsolidasiRows.push({
        code: '',
        name: 'JUMLAH BEBAN OPERASIONAL',
        level: 1,
        saldoKemarin: totalBebanKemarin,
        debet: totalBebanDebet,
        kredit: totalBebanKredit,
        saldoAkhir: totalBebanAkhir,
        isTotal: true
      });

      // Grand Total Laba Bersih
      konsolidasiRows.push({
        code: '',
        name: 'LABA (RUGI) BERSIH OPERASIONAL',
        level: 1,
        saldoKemarin: labaBersihKemarin,
        debet: labaBersihDebet,
        kredit: labaBersihKredit,
        saldoAkhir: labaBersihAkhir,
        isGrandTotal: true
      });

      return {
        simple: {
          period: label,
          revenues,
          cogs,
          operationalExpenses
        },
        konsolidasi: {
          title: 'LAPORAN LABA-RUGI KONSOLIDASI HARIAN',
          periodDate: label,
          entityName: stationInfo?.name || 'PT SPBU Mitra Akrual 1954',
          location: stationInfo?.address || 'Lubuk Alung',
          signerDate: new Date().toLocaleDateString('id-ID'),
          rows: konsolidasiRows
        }
      };
    } catch (err) {
      return this.handleDbError(err, 'Gagal menyusun Laporan Laba Rugi dari SQLite');
    }
  }

  /**
   * Mengambil Laporan Arus Kas berdasarkan mutasi akun Kas & Bank
   */
  public async getArusKas(period?: string, _stationInfo?: StationInfo): Promise<ReportsData['arusKas']> {
    const { startDate, endDate, label } = parsePeriodFilter(period);

    try {
      // Saldo awal kas & bank (Akun 1-1001 Kas Fisik dan 1-1002 Rekening Bank)
      let saldoAwalKasFisik = 0;
      let saldoAwalBank = 0;
      if (startDate) {
        const awalRows = await this.executor.query<any>(
          `SELECT je.account_id,
                  COALESCE(SUM(je.debit - je.credit), 0) AS saldo_awal
           FROM journal_entries je
           JOIN journals j ON je.journal_id = j.id
           WHERE je.account_id IN ('1-1001', '1-1002') AND substr(j.date, 1, 10) < ?
           GROUP BY je.account_id;`,
          [startDate]
        );
        for (const row of awalRows) {
          if (row.account_id === '1-1001') saldoAwalKasFisik = Number(row.saldo_awal || 0);
          if (row.account_id === '1-1002') saldoAwalBank = Number(row.saldo_awal || 0);
        }
      }
      const saldoAwal = saldoAwalKasFisik + saldoAwalBank;

      // Filter tanggal mutasi
      let dateFilter = '';
      const params: any[] = [];
      if (startDate && endDate) {
        dateFilter = ' AND substr(j.date, 1, 10) >= ? AND substr(j.date, 1, 10) <= ? ';
        params.push(startDate, endDate);
      }

      // Ambil transaksi kas masuk dan keluar beserta lawan akunnya (offsetting account)
      const flowRows = await this.executor.query<any>(
        `SELECT
           je.account_id AS cash_acc_id,
           je.debit, je.credit,
           other.account_id AS counter_acc_id,
           other_acc.code AS counter_code,
           other_acc.name AS counter_name,
           other_acc.category AS counter_category,
           j.trans_code, j.description
         FROM journal_entries je
         JOIN journals j ON je.journal_id = j.id ${dateFilter}
         JOIN journal_entries other ON je.journal_id = other.journal_id AND je.id != other.id
         JOIN accounts other_acc ON other.account_id = other_acc.id
         WHERE je.account_id IN ('1-1001', '1-1002');`,
        params
      );

      let penKasBBM = 0;              // Penerimaan Kas Fisik Tunai
      let penBankBBM = 0;             // Penerimaan via Transfer Bank Mandiri
      let penPelunasanPiutangKas = 0;  // Pelunasan Piutang Kas Fisik
      let penPelunasanPiutangBank = 0; // Pelunasan Piutang Transfer Bank
      let pengBeliTunai = 0;          // Pembelian Persediaan Tunai Kas Fisik
      let pengTransferDO = 0;         // Penebusan DO Transfer Bank Mandiri
      let pengBebanOpsKas = 0;        // Beban Operasional Kas Fisik
      let pengBebanOpsBank = 0;       // Beban Operasional Transfer Bank
      let pengBayarHutangKas = 0;     // Pelunasan Hutang Kas Fisik
      let pengBayarHutangBank = 0;    // Pelunasan Hutang Transfer Bank

      let perolehanAsetKas = 0;
      let perolehanAsetBank = 0;
      let setoranModalKas = 0;
      let setoranModalBank = 0;

      for (const row of flowRows) {
        const cashAcc = row.cash_acc_id; // '1-1001' (Kas Fisik) atau '1-1002' (Bank)
        const debit = Number(row.debit || 0);
        const credit = Number(row.credit || 0);
        const counterCode = row.counter_code || '';
        const counterCat = row.counter_category || '';

        // Kas Masuk (Debit pada akun Kas/Bank)
        if (debit > 0) {
          if (counterCat === 'Pendapatan' || counterCode.startsWith('4-')) {
            if (cashAcc === '1-1001') {
              penKasBBM += debit;
            } else if (cashAcc === '1-1002') {
              penBankBBM += debit;
            }
          } else if (counterCode === '1-1101') {
            if (cashAcc === '1-1001') {
              penPelunasanPiutangKas += debit;
            } else if (cashAcc === '1-1002') {
              penPelunasanPiutangBank += debit;
            }
          } else if (counterCat === 'Ekuitas' || counterCode.startsWith('3-')) {
            if (cashAcc === '1-1001') {
              setoranModalKas += debit;
            } else if (cashAcc === '1-1002') {
              setoranModalBank += debit;
            }
          }
        }

        // Kas Keluar (Credit pada akun Kas/Bank)
        if (credit > 0) {
          if (counterCode === '1-1201' || counterCode.startsWith('1-12')) {
            if (cashAcc === '1-1002') {
              pengTransferDO -= credit; // Penebusan DO via Transfer Bank Mandiri
            } else {
              pengBeliTunai -= credit; // Pembelian Tunai Kas Fisik
            }
          } else if (counterCat === 'Beban' || counterCode.startsWith('6-') || counterCode.startsWith('5-')) {
            if (cashAcc === '1-1001') {
              pengBebanOpsKas -= credit;
            } else if (cashAcc === '1-1002') {
              pengBebanOpsBank -= credit;
            }
          } else if (counterCode === '2-1001' || counterCat === 'Kewajiban') {
            if (cashAcc === '1-1001') {
              pengBayarHutangKas -= credit;
            } else if (cashAcc === '1-1002') {
              pengBayarHutangBank -= credit;
            }
          } else if (counterCode.startsWith('1-15')) {
            if (cashAcc === '1-1001') {
              perolehanAsetKas -= credit;
            } else if (cashAcc === '1-1002') {
              perolehanAsetBank -= credit;
            }
          }
        }
      }

      const operasional: FinancialItem[] = [
        { name: 'Penerimaan Penjualan BBM Tunai (Kas Fisik)', amount: penKasBBM },
        { name: 'Penerimaan Penjualan BBM (Transfer Bank Mandiri)', amount: penBankBBM },
        { name: 'Penerimaan Pelunasan Piutang (Kas Fisik)', amount: penPelunasanPiutangKas },
        { name: 'Penerimaan Pelunasan Piutang (Transfer Bank Mandiri)', amount: penPelunasanPiutangBank },
        { name: 'Pembelian Persediaan Tunai (Kas Fisik)', amount: pengBeliTunai },
        { name: 'Penebusan DO Pertamina (Transfer Bank Mandiri)', amount: pengTransferDO },
        { name: 'Pembayaran Beban Operasional & Gaji (Kas Fisik)', amount: pengBebanOpsKas },
        { name: 'Pembayaran Beban Operasional (Transfer Bank Mandiri)', amount: pengBebanOpsBank },
        { name: 'Pembayaran Pelunasan Hutang Usaha (Kas Fisik)', amount: pengBayarHutangKas },
        { name: 'Pembayaran Pelunasan Hutang Usaha (Transfer Bank Mandiri)', amount: pengBayarHutangBank }
      ].filter(item => item.amount !== 0);

      // Jika kosong, sediakan label dasar dengan nilai 0 dari database
      if (operasional.length === 0) {
        operasional.push(
          { name: 'Penerimaan Penjualan BBM Tunai (Kas Fisik)', amount: 0 },
          { name: 'Penerimaan Penjualan BBM (Transfer Bank)', amount: 0 },
          { name: 'Pengeluaran Pembelian Persediaan & Operasional', amount: 0 }
        );
      }

      const investasi: FinancialItem[] = [];
      if (perolehanAsetKas !== 0) {
        investasi.push({ name: 'Perolehan Aset Tetap (Kas Fisik)', amount: perolehanAsetKas });
      }
      if (perolehanAsetBank !== 0) {
        investasi.push({ name: 'Perolehan Aset Tetap (Transfer Bank)', amount: perolehanAsetBank });
      }

      const pendanaan: FinancialItem[] = [];
      if (setoranModalKas !== 0) {
        pendanaan.push({ name: 'Setoran Modal Pemilik (Kas Fisik)', amount: setoranModalKas });
      }
      if (setoranModalBank !== 0) {
        pendanaan.push({ name: 'Setoran Modal Pemilik (Transfer Bank)', amount: setoranModalBank });
      }

      const saldoAkhirKasFisik = saldoAwalKasFisik + penKasBBM + penPelunasanPiutangKas + setoranModalKas + pengBeliTunai + pengBebanOpsKas + pengBayarHutangKas + perolehanAsetKas;
      const saldoAkhirBank = saldoAwalBank + penBankBBM + penPelunasanPiutangBank + setoranModalBank + pengTransferDO + pengBebanOpsBank + pengBayarHutangBank + perolehanAsetBank;

      return {
        period: label,
        operasional,
        investasi,
        pendanaan,
        saldoAwal,
        saldoAwalKasFisik,
        saldoAwalBank,
        saldoAkhirKasFisik,
        saldoAkhirBank
      };
    } catch (err) {
      return this.handleDbError(err, 'Gagal menyusun Laporan Arus Kas dari SQLite');
    }
  }

  /**
   * Mengambil Laporan Stok & Penjualan BBM
   */
  public async getStokPenjualan(period?: string): Promise<StockReportItem[]> {
    const { startDate, endDate } = parsePeriodFilter(period);

    try {
      let txDateFilter = '';
      const params: any[] = [];
      if (startDate && endDate) {
        txDateFilter = ` AND substr(tx.date, 1, 10) >= ? AND substr(tx.date, 1, 10) <= ? `;
        params.push(startDate, endDate);
      }

      const rows = await this.executor.query<any>(
        `SELECT
           p.id, p.code, p.name,
           COALESCE(SUM(t.current_stock), 0) AS tank_stock,
           COALESCE(SUM(t.capacity), 0) AS tank_cap,
           (SELECT COALESCE(SUM(tx.volume), 0)
            FROM transactions tx
            WHERE tx.product_id = p.id AND tx.category = 'Pembelian' AND tx.status = 'Selesai' ${txDateFilter}) AS volume_pembelian,
           (SELECT COALESCE(SUM(tx.volume), 0)
            FROM transactions tx
            WHERE tx.product_id = p.id AND tx.category = 'Penjualan' AND tx.status = 'Selesai' ${txDateFilter}) AS volume_penjualan
         FROM products p
         LEFT JOIN tanks t ON p.id = t.product_id
         WHERE p.status = 'Aktif'
         GROUP BY p.id, p.code, p.name
         ORDER BY p.code ASC;`,
        params.concat(params)
      );

      return rows.map((r) => {
        const stokAwal = Number(r.tank_stock || 0);
        const pembelian = Number(r.volume_pembelian || 0);
        const penjualan = Number(r.volume_penjualan || 0);
        const kapasitasTanki = Number(r.tank_cap || 0);
        // Estimasi stok berjalan dari mutasi transaksi
        const stokAkhir = stokAwal + pembelian - penjualan;
        const persenTerisi = kapasitasTanki > 0
          ? Math.min(100, Math.max(0, Math.round((stokAkhir / kapasitasTanki) * 100)))
          : 0;

        return {
          code: r.code,
          name: r.name,
          stokAwal,
          pembelian,
          penjualan,
          penyesuaian: 0,
          stokAkhir,
          unit: 'Liter',
          kapasitasTanki,
          persenTerisi,
          statusStok: 'Estimasi Mutasi Transaksi',
          isEstimasi: true
        };
      });
    } catch (err) {
      return this.handleDbError(err, 'Gagal menyusun Laporan Stok Penjualan dari SQLite');
    }
  }

  /**
   * Mengambil Rekapitulasi Penjualan & Sesi Shift dari Transaksi Aktual SQLite
   */
  public async getSalesAndShiftRecap(period?: string): Promise<SalesAndShiftRecap> {
    const { startDate, endDate, label } = parsePeriodFilter(period);

    try {
      let dateFilter = '';
      const params: any[] = [];
      if (startDate && endDate) {
        dateFilter = ` AND substr(t.date, 1, 10) >= ? AND substr(t.date, 1, 10) <= ? `;
        params.push(startDate, endDate);
      }

      // 1. Ringkasan penjualan berdasarkan metode pembayaran
      const methodRows = await this.executor.query<any>(
        `SELECT
           COALESCE(t.payment_method, 'Tunai') AS method,
           COALESCE(SUM(t.total), 0) AS total_amount,
           COUNT(t.id) AS tx_count
         FROM transactions t
         WHERE t.category = 'Penjualan' AND t.status = 'Selesai' ${dateFilter}
         GROUP BY COALESCE(t.payment_method, 'Tunai');`,
        params
      );

      let totalGrossSales = 0;
      let cashSales = 0;
      let creditSales = 0;
      let transferSales = 0;

      const byPaymentMethod: PaymentMethodSalesSummary[] = methodRows.map((r) => {
        const amt = Number(r.total_amount || 0);
        totalGrossSales += amt;
        if (r.method === 'Tunai') cashSales += amt;
        else if (r.method === 'Piutang') creditSales += amt;
        else if (r.method === 'Transfer') transferSales += amt;

        return {
          method: r.method,
          amount: amt,
          transactionCount: Number(r.tx_count || 0)
        };
      });

      // 2. Ringkasan per produk
      const prodRows = await this.executor.query<any>(
        `SELECT
           p.id, p.name,
           COALESCE(SUM(t.volume), 0) AS total_volume,
           COALESCE(SUM(t.total), 0) AS total_amount
         FROM transactions t
         JOIN products p ON t.product_id = p.id
         WHERE t.category = 'Penjualan' AND t.status = 'Selesai' ${dateFilter}
         GROUP BY p.id, p.name
         ORDER BY total_amount DESC;`,
        params
      );

      const byProduct = prodRows.map((r) => ({
        productId: r.id,
        productName: r.name,
        volume: Number(r.total_volume || 0),
        amount: Number(r.total_amount || 0)
      }));

      // 3. Rekapitulasi per sesi shift
      const shiftRows = await this.executor.query<any>(
        `SELECT
           s.id, s.name, s.operator, s.status, s.initial_cash, s.cash_handover, s.discrepancy,
           (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai') AS actual_total_sales,
           (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai' AND t.payment_method = 'Tunai') AS actual_cash_sales,
           (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai' AND t.payment_method = 'Piutang') AS actual_credit_sales,
           (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai' AND t.payment_method = 'Transfer') AS actual_transfer_sales
         FROM shifts s
         ORDER BY s.id ASC;`
      );

      const nonShiftSummary = await this.executor.query<any>(
        `SELECT
           COUNT(t.id) AS tx_count,
           COALESCE(SUM(t.total), 0) AS actual_total_sales,
           COALESCE(SUM(CASE WHEN t.payment_method = 'Tunai' THEN t.total ELSE 0 END), 0) AS actual_cash_sales,
           COALESCE(SUM(CASE WHEN t.payment_method = 'Piutang' THEN t.total ELSE 0 END), 0) AS actual_credit_sales,
           COALESCE(SUM(CASE WHEN t.payment_method = 'Transfer' THEN t.total ELSE 0 END), 0) AS actual_transfer_sales
         FROM transactions t
         WHERE (t.shift_id IS NULL OR t.shift_id = '') AND t.category = 'Penjualan' AND t.status = 'Selesai' ${dateFilter};`,
        params
      );

      const shifts: ShiftSalesItem[] = shiftRows.map((s) => ({
        shiftId: s.id,
        shiftName: s.name,
        operator: s.operator || '-',
        status: s.status,
        initialCash: Number(s.initial_cash || 0),
        totalSales: Number(s.actual_total_sales || 0),
        cashSales: Number(s.actual_cash_sales || 0),
        creditSales: Number(s.actual_credit_sales || 0),
        transferSales: Number(s.actual_transfer_sales || 0),
        cashHandover: Number(s.cash_handover || 0),
        discrepancy: s.discrepancy != null ? Number(s.discrepancy) : undefined
      }));

      if (nonShiftSummary && nonShiftSummary[0] && Number(nonShiftSummary[0].tx_count || 0) > 0) {
        shifts.push({
          shiftId: 'NON-SHIFT',
          shiftName: 'Transaksi Tanpa Sesi / Administratif',
          operator: 'Admin SPBU',
          status: 'Tutup',
          initialCash: 0,
          totalSales: Number(nonShiftSummary[0].actual_total_sales || 0),
          cashSales: Number(nonShiftSummary[0].actual_cash_sales || 0),
          creditSales: Number(nonShiftSummary[0].actual_credit_sales || 0),
          transferSales: Number(nonShiftSummary[0].actual_transfer_sales || 0),
          cashHandover: 0,
          discrepancy: undefined
        });
      }

      return {
        period: label,
        totalGrossSales,
        cashSales,
        creditSales,
        transferSales,
        byPaymentMethod,
        byProduct,
        shifts
      };
    } catch (err) {
      return this.handleDbError(err, 'Gagal menyusun Rekapitulasi Penjualan & Shift dari SQLite');
    }
  }

  /**
   * Mengambil snapshot lengkap seluruh laporan operasional & keuangan
   */
  public async getAllReports(period?: string, stationInfo?: StationInfo): Promise<ReportsData> {
    const [neracaKonsolidasi, labaRugiData, arusKas, stokPenjualan, salesAndShiftRecap] = await Promise.all([
      this.getNeraca(period, stationInfo),
      this.getLabaRugi(period, stationInfo),
      this.getArusKas(period, stationInfo),
      this.getStokPenjualan(period),
      this.getSalesAndShiftRecap(period)
    ]);

    return {
      neracaKonsolidasi,
      labaRugi: labaRugiData.simple,
      labaRugiKonsolidasi: labaRugiData.konsolidasi,
      arusKas,
      stokPenjualan,
      salesAndShiftRecap
    };
  }
}

export const reportRepository = new ReportRepository();
