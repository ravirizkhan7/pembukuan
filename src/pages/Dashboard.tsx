import React from 'react';
import { PageHeader, MetricCard } from '../components/common';
import { Card, Button, Badge } from '../components/ui';
import {
  Product,
  Tank,
  Nozzle,
  Shift,
  Tera,
  Transaction,
  StationInfo
} from '../types';
import { useAppContext } from '../context/AppContext';

export interface DashboardPageProps {
  mockData?: {
    mockProducts: Product[];
    mockTanks: Tank[];
    mockNozzles: Nozzle[];
    mockShifts: Shift[];
    mockTera: Tera[];
    mockTransactions: Transaction[];
  };
  stationInfo?: StationInfo;
  onNavigate: (navId: string, subNavId?: string) => void;
}

export function DashboardPage({
  onNavigate
}: DashboardPageProps) {
  const { activeShift, tanks, transactions, stationInfo, accounts } = useAppContext();
  const currentStationName = stationInfo?.id || 'SPBU';

  // Saldo akun dinamis dari state Bagan Akun (COA)
  const kasUtamaAcc = accounts.find((a) => a.code === '1-1001');
  const piutangAcc = accounts.find((a) => a.code === '1-1101');
  const hutangAcc = accounts.find((a) => a.code === '2-1001');

  const saldoKas = kasUtamaAcc ? kasUtamaAcc.balance : 0;
  const saldoPiutang = piutangAcc ? piutangAcc.balance : 0;
  const saldoHutang = hutangAcc ? hutangAcc.balance : 0;

  return (
    <div>
      <PageHeader
        title="Ringkasan Operasional Hari Ini"
        subtitle={`${activeShift ? activeShift.name : 'Belum Ada Shift Aktif'} • ${currentStationName} • Tanggal 24 September 2026`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('transaksi')}
            style={{ fontWeight: 700, padding: '0 16px' }}
          >
            + Input Transaksi
          </Button>
        }
      />

      {/* Ringkasan Keuangan & Transaksi (Metric Cards Dinamis dari Saldo Akun) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '22px'
        }}
      >
        <MetricCard
          title="Penjualan Shift"
          value={activeShift ? `Rp ${activeShift.totalSales.toLocaleString('id-ID')}` : 'Rp 0'}
          subtitle={activeShift ? `${activeShift.name} • ${transactions.filter(t => t.shiftId === activeShift.id).length} Transaksi` : 'Tidak ada shift berjalan'}
        />
        <MetricCard
          title="Saldo Kas Utama"
          value={`Rp ${saldoKas.toLocaleString('id-ID')}`}
          subtitle="Akun [1-1001] Kas Brankas"
        />
        <MetricCard
          title="Saldo Piutang Usaha"
          value={`Rp ${saldoPiutang.toLocaleString('id-ID')}`}
          subtitle="Akun [1-1101] Tagihan Kupon"
        />
        <MetricCard
          title="Saldo Hutang Usaha"
          value={`Rp ${saldoHutang.toLocaleString('id-ID')}`}
          subtitle="Akun [2-1001] Hutang Pertamina"
        />
      </div>

      {/* Grid: Status Stok Tanki & Shift Info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '18px',
          marginBottom: '22px'
        }}
      >
        {/* Status Tanki Pendam */}
        <Card
          title="Status Stok Tanki Pendam"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('monitoring', 'tanki')}
              style={{ fontSize: '12.5px', color: 'var(--color-primary)' }}
            >
              Lihat Rincian →
            </Button>
          }
        >
          <div className="table-responsive" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanki</th>
                  <th>Produk</th>
                  <th className="table-num">Kapasitas</th>
                  <th className="table-num">Stok Saat Ini</th>
                </tr>
              </thead>
              <tbody>
                {tanks.map((tank) => {
                  const percentage = Math.round((tank.currentStock / tank.capacity) * 100);
                  const isLow = percentage < 35;
                  return (
                    <tr key={tank.id}>
                      <td style={{ fontWeight: 600 }}>{tank.name}</td>
                      <td style={{ color: 'var(--color-dark-text)' }}>{tank.productName}</td>
                      <td className="table-num">{tank.capacity.toLocaleString('id-ID')} L</td>
                      <td className="table-num">
                        <span
                          style={{
                            color: isLow ? 'var(--color-danger)' : 'var(--color-dark-text)',
                            fontWeight: isLow ? 700 : 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            justifyContent: 'flex-end'
                          }}
                        >
                          {tank.currentStock.toLocaleString('id-ID')} L ({percentage}%)
                          {isLow && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 4px',
                                borderRadius: '2px',
                                backgroundColor: 'var(--color-danger-light)',
                                color: 'var(--color-danger)'
                              }}
                            >
                              Low
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Shift Berjalan */}
        <Card
          title="Shift Berjalan"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('monitoring', 'shift')}
              style={{ fontSize: '12.5px', color: 'var(--color-primary)' }}
            >
              Kelola Shift →
            </Button>
          }
        >
          {activeShift ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '9px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span className="text-muted" style={{ fontWeight: 500 }}>Nama Shift:</span>
                <strong style={{ color: 'var(--color-dark-text)' }}>{activeShift.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '9px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span className="text-muted" style={{ fontWeight: 500 }}>Jam Kerja:</span>
                <span style={{ fontWeight: 500 }}>{activeShift.startTime} - {activeShift.endTime} WIB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '9px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span className="text-muted" style={{ fontWeight: 500 }}>Operator Kasir:</span>
                <span style={{ fontWeight: 600 }}>{activeShift.operator}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '9px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span className="text-muted" style={{ fontWeight: 500 }}>Estimasi Kas Shift:</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary-dark)', fontSize: '14.5px' }}>
                  Rp {activeShift.totalSales.toLocaleString('id-ID')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{ fontWeight: 500 }}>Status:</span>
                <Badge variant="primary">
                  {activeShift.status}
                </Badge>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-muted-text)', fontSize: '13.5px', marginBottom: '12px' }}>
                Belum ada sesi shift yang aktif saat ini.
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('monitoring', 'shift')}
              >
                Buka Shift Sekarang
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Tabel Transaksi Terakhir */}
      <Card
        title="Transaksi Terakhir"
        subtitle={`${activeShift ? activeShift.name : 'Seluruh Sesi'} • ${currentStationName}`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('transaksi')}
            style={{ fontSize: '12.5px', color: 'var(--color-primary)' }}
          >
            Buka Transaksi →
          </Button>
        }
      >
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Kode</th>
                <th>Transaksi</th>
                <th>Kategori</th>
                <th className="table-num">Volume</th>
                <th className="table-num">Nominal</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--color-muted-text)' }}>
                    {tx.date.split(' ')[1]}
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        backgroundColor: 'var(--blue-50)',
                        color: 'var(--color-primary-dark)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid var(--blue-200)',
                        fontSize: '12px'
                      }}
                    >
                      {tx.code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--color-dark-text)' }}>{tx.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>{tx.category}</td>
                  <td className="table-num">{tx.volume > 0 ? `${tx.volume} L` : '-'}</td>
                  <td className="table-num" style={{ fontWeight: 700, color: 'var(--color-dark-text)' }}>
                    Rp {tx.total.toLocaleString('id-ID')}
                  </td>
                  <td style={{ fontSize: '12.5px' }}>{tx.cashier.split(' ')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
