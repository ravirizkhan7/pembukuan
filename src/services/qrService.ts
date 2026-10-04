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
 * Generate a complete Employee ID Card PNG as Data URL
 * Consists of:
 * - [ QR CODE ] (payload is strictly employee ID, e.g. "OPR-004")
 * - Nama Pegawai (e.g. "Rima")
 * - Jabatan Pegawai (e.g. "Operator Kasir")
 *
 * All in one single PNG image, client-side & offline via HTML5 Canvas.
 */
export async function generateEmployeeIdCardPngDataUrl(
  payload: string,
  name: string,
  role: string,
  options?: EmployeeIdCardOptions
): Promise<string> {
  const cardWidth = options?.width || 420;
  const cardHeight = options?.height || 540;
  const qrSize = options?.qrSize || 280;

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

      // Card border with smooth rounded corners
      const borderMargin = 12;
      const borderWidth = cardWidth - borderMargin * 2;
      const borderHeight = cardHeight - borderMargin * 2;
      const radius = 16;

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
      ctx.quadraticCurveTo(borderMargin, borderMargin, borderMargin + radius, borderMargin);
      ctx.closePath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Top subtle accent bar
      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(borderMargin + 4, borderMargin + 2, borderWidth - 8, 5);

      // Load QR Image
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        try {
          // Draw QR centered horizontally
          const qrX = Math.round((cardWidth - qrSize) / 2);
          const qrY = 38;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          const centerX = cardWidth / 2;

          // Subtle divider line below QR
          ctx.strokeStyle = '#F1F5F9';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(36, qrY + qrSize + 16);
          ctx.lineTo(cardWidth - 36, qrY + qrSize + 16);
          ctx.stroke();

          // Employee Name (dynamic font size if name is long)
          ctx.fillStyle = '#0F172A';
          let nameFontSize = 24;
          ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          while (ctx.measureText(name).width > cardWidth - 60 && nameFontSize > 16) {
            nameFontSize -= 2;
            ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, centerX, qrY + qrSize + 48);

          // Employee ID badge
          const idText = payload;
          ctx.font = 'bold 14px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
          const idWidth = ctx.measureText(idText).width;
          const badgePadX = 14;
          const badgeHeight = 26;
          const badgeX = centerX - (idWidth + badgePadX * 2) / 2;
          const badgeY = qrY + qrSize + 70;

          // Draw badge background
          ctx.fillStyle = '#EFF6FF';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(badgeX, badgeY, idWidth + badgePadX * 2, badgeHeight, 6);
          } else {
            ctx.rect(badgeX, badgeY, idWidth + badgePadX * 2, badgeHeight);
          }
          ctx.fill();
          ctx.strokeStyle = '#BFDBFE';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Badge text
          ctx.fillStyle = '#1D4ED8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(idText, centerX, badgeY + badgeHeight / 2);

          // Employee Role / Jabatan
          ctx.fillStyle = '#475569';
          ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(role, centerX, badgeY + badgeHeight + 26);

          // Bottom card identity footer
          ctx.fillStyle = '#94A3B8';
          ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          ctx.fillText('SPBU IDENTITY CARD', centerX, cardHeight - 26);

          // Export as PNG Data URL
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
