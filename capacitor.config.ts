import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Konfigurasi Capacitor untuk AKRUAL — Pembukuan SPBU
 * 
 * CATATAN IDENTITAS APLIKASI:
 * - appId saat ini menggunakan ID sementara: 'com.akrual.pembukuan'
 * - Identitas paket final (misal: 'id.co.akrual.spbu' atau domain terdaftar klien)
 *   harus dikonfirmasi sebelum APK resmi didistribusikan ke klien/produksi.
 * - webDir disetel ke 'dist' (output resmi build Vite).
 * - Seluruh aset dikemas secara lokal (tidak menggunakan server.url eksternal).
 */
const config: CapacitorConfig = {
  appId: 'com.akrual.pembukuan',
  appName: 'AKRUAL SPBU',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for capacitor sqlite',
        biometricSubTitle: 'Log in using your biometric credential'
      }
    }
  }
};

export default config;
