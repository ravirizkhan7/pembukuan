import QRCode from 'qrcode';
import { saveOrDownloadFile } from './fileSaver';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface EmployeeIdCardOptions {
  width?: number;
  height?: number;
  qrSize?: number;
}

/**
 * Generate QR code as Base64 Data URL (PNG format)
 * Completely offline and client-side, using standard qrcode library.
 * Default: 360px width, margin 2 (quiet zone), error correction level 'M'.
 */
export async function generateQrDataUrl(
  payload: string,
  options?: QrCodeOptions
): Promise<string> {
  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    width: options?.width || 360,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  return await QRCode.toDataURL(payload, qrOptions);
}

/**
 * Generate a minimalist, compact Employee ID Card PNG as Data URL
 *
 * Structure:
 * ┌─────────────────────────────┐
 * │                             │
 * │         QR CODE             │
 * │                             │
 * │        Nama Pegawai         │
 * │         Jabatan             │
 * │                             │
 * │          OPR-001            │
 * │                             │
 * └─────────────────────────────┘
 *
 * Minimalist, compact, professional, clean whitespace.
 * Zero unnecessary decorative borders, zero gradients, no banner text.
 * 100% Client-side & offline via HTML5 Canvas.
 */
export async function generateEmployeeIdCardPngDataUrl(
  payload: string,
  name: string,
  role: string,
  options?: EmployeeIdCardOptions
): Promise<string> {
  const cardWidth = options?.width || 340;
  const cardHeight = options?.height || 380;
  const qrSize = options?.qrSize || 190;

  // 1. Generate QR Code image with payload strictly containing employee ID
  const qrDataUrl = await generateQrDataUrl(payload, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  // 2. Render onto an offscreen canvas
  return new Promise((resolve, reject) => {
    try {
      if (typeof document === 'undefined') {
        resolve(qrDataUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = cardWidth;
      canvas.height = cardHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(qrDataUrl);
        return;
      }

      // Background - Pure White
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      // Clean single subtle card outline (1px border #E2E8F0, rounded corners 12px)
      const borderMargin = 8;
      const borderWidth = cardWidth - borderMargin * 2;
      const borderHeight = cardHeight - borderMargin * 2;
      const radius = 12;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(borderMargin + radius, borderMargin);
      ctx.lineTo(borderMargin + borderWidth - radius, borderMargin);
      ctx.quadraticCurveTo(borderMargin + borderWidth, borderMargin, borderMargin + borderWidth, borderMargin + radius);
      ctx.lineTo(borderMargin + borderWidth, borderMargin + borderHeight - radius);
      ctx.quadraticCurveTo(borderMargin + borderWidth, borderMargin + borderHeight, borderMargin + borderWidth - radius, borderMargin + borderHeight);
      ctx.lineTo(borderMargin + radius, borderMargin + borderHeight);
      ctx.quadraticCurveTo(borderMargin, borderMargin + borderHeight, borderMargin, borderMargin + borderHeight - radius);
      ctx.lineTo(borderMargin, borderMargin + radius);
      ctx.quadraticCurveTo(borderMargin, borderMargin + borderHeight - radius, borderMargin, borderMargin);
      ctx.closePath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Load QR Image
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        try {
          // 1. Draw QR centered horizontally
          const qrX = Math.round((cardWidth - qrSize) / 2);
          const qrY = 28;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          const centerX = cardWidth / 2;

          // 2. Nama Pegawai (Paling Menonjol)
          ctx.fillStyle = '#0F172A';
          let nameFontSize = 20;
          ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          while (ctx.measureText(name).width > cardWidth - 48 && nameFontSize > 15) {
            nameFontSize -= 1;
            ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, centerX, qrY + qrSize + 36);

          // 3. Jabatan Pegawai (Secondary)
          ctx.fillStyle = '#64748B';
          let roleFontSize = 14;
          ctx.font = `500 ${roleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          while (ctx.measureText(role).width > cardWidth - 48 && roleFontSize > 12) {
            roleFontSize -= 1;
            ctx.font = `500 ${roleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(role, centerX, qrY + qrSize + 64);

          // 4. ID Pegawai (Identifier Kecil)
          ctx.fillStyle = '#94A3B8';
          ctx.font = '600 13px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(payload, centerX, qrY + qrSize + 90);

          // Export as clean PNG Data URL
          const cardDataUrl = canvas.toDataURL('image/png');
          resolve(cardDataUrl);
        } catch (drawErr) {
          reject(drawErr);
        }
      };

      qrImg.onerror = (imgErr) => {
        reject(imgErr);
      };

      qrImg.src = qrDataUrl;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convert Base64 Data URL to Blob (image/png)
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const uint8Arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    uint8Arr[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([uint8Arr], { type: mime });
}

/**
 * Format standard QR download filename:
 * Sanitizes any invalid filesystem characters.
 * Contoh: "QR-Rima-OPR-004.png"
 */
export function formatQrFilename(name: string, id: string): string {
  const cleanName = name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  const cleanId = id.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  return `QR-${cleanName}-${cleanId}.png`;
}

/**
 * Download QR Code as PNG file directly from browser
 */
export function downloadQrPng(dataUrl: string, filename: string): void {
  const blob = dataUrlToBlob(dataUrl);
  saveOrDownloadFile(blob, filename);
}
