/**
 * File Saver Abstraction
 * Memisahkan penyimpanan file dari browser DOM API langsung
 * sehingga saat migrasi ke Capacitor / Android APK nantinya,
 * fungsi ini cukup diganti dengan @capacitor/filesystem / share
 * tanpa perlu mengubah kode pembuatan dokumen PDF laporan.
 */

export function saveOrDownloadFile(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}
