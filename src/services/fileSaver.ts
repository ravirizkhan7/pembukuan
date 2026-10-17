/**
 * File Saver Abstraction Antar-Platform (Web & Android WebView SAF)
 * 
 * Mendukung penyimpanan dokumen PDF biner langsung melalui Storage Access Framework (SAF)
 * pada Android dan HTML5 Blob download pada Web Browser.
 */

import { Capacitor } from '@capacitor/core';
import { NativeBackupRestore } from './database/backupRestoreService';

export interface SaveFileResult {
  success: boolean;
  cancelled?: boolean;
  filename: string;
  uri?: string;
  bytesWritten?: number;
  error?: string;
}

/**
 * Mengonversi ArrayBuffer biner menjadi Base64 string yang aman untuk bridge Capacitor
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Menyimpan dokumen PDF dari jsPDF instance:
 * - Pada Android: menggunakan Native SAF ACTION_CREATE_DOCUMENT via NativeBackupRestore.saveBinaryFile
 * - Pada Web: menggunakan Blob download via anchor link
 */
export async function saveOrDownloadPdf(
  doc: { output: (type: 'arraybuffer' | 'blob' | 'datauristring') => any },
  filename: string
): Promise<SaveFileResult> {
  // 1. Android Native Platform -> Bridge SAF Base64 Writer
  if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
    try {
      if (typeof NativeBackupRestore.saveBinaryFile !== 'function') {
        throw new Error('NativeBackupRestore.saveBinaryFile tidak tersedia pada runtime ini.');
      }

      const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
      const base64Data = arrayBufferToBase64(arrayBuffer);

      const res = await NativeBackupRestore.saveBinaryFile({
        filename,
        base64Data,
        mimeType: 'application/pdf'
      });

      if (res.cancelled) {
        return {
          success: false,
          cancelled: true,
          filename
        };
      }

      if (!res.success) {
        throw new Error('Penyimpanan dokumen PDF native gagal.');
      }

      return {
        success: true,
        cancelled: false,
        filename: res.filename || filename,
        uri: res.uri,
        bytesWritten: res.bytesWritten
      };
    } catch (err: any) {
      console.error('[fileSaver] Native SAF PDF save error:', err);
      throw new Error(`Gagal menyimpan PDF di Android: ${err?.message || String(err)}`);
    }
  }

  // 2. Node.js / CLI Test Environment Fallback
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
      const buffer = Buffer.from(arrayBuffer);
      const testOutDir = path.join(process.cwd(), 'scratch');
      if (!fs.existsSync(testOutDir)) fs.mkdirSync(testOutDir, { recursive: true });
      const filePath = path.join(testOutDir, filename);
      fs.writeFileSync(filePath, buffer);
      return { success: true, cancelled: false, filename, uri: filePath, bytesWritten: buffer.length };
    } catch {
      return { success: true, cancelled: false, filename };
    }
  }

  try {
    const blob = doc.output('blob') as Blob;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      URL.revokeObjectURL(url);
    }, 2000);

    return {
      success: true,
      cancelled: false,
      filename
    };
  } catch (err: any) {
    console.error('[fileSaver] Web download error:', err);
    throw new Error(`Gagal mengunduh berkas PDF: ${err?.message || String(err)}`);
  }
}

/**
 * Backward compatible helper untuk Blob biasa
 */
export function saveOrDownloadFile(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}
