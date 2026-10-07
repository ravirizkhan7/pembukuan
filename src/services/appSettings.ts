/**
 * SETTINGS & RECOVERY ABSTRACTION SERVICE
 * Modul terpusat untuk konfigurasi identitas SPBU, validasi credential PIN,
 * dan mekanisme recovery akun tanpa ketergantungan external SMTP/API.
 */

/**
 * Validasi sintaks alamat email
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validasi format PIN aplikasi:
 * Wajib berupa 4-6 digit numerik
 */
export function validatePinFormat(pin: string): { valid: boolean; message?: string } {
  if (!pin) {
    return { valid: false, message: 'PIN wajib diisi.' };
  }
  if (!/^\d+$/.test(pin)) {
    return { valid: false, message: 'PIN harus berupa angka numerik.' };
  }
  if (pin.length < 4 || pin.length > 6) {
    return { valid: false, message: 'PIN harus terdiri dari 4 sampai 6 digit angka.' };
  }
  return { valid: true };
}

/**
 * Abstraksi verifikasi email recovery.
 * Saat ini: Membandingkan dengan registered email yang tersimpan pada application settings.
 * Nanti: Mekanisme dapat ditingkatkan menjadi asymmetric token / local master key
 * sesuai keputusan arsitektur distribusi offline.
 *
 * NOTE: Sesuai aturan security & offline constraint, tidak membocorkan email yang benar
 * jika input salah, dan tidak mengklaim email terkirim.
 */
export function verifyRecoveryEmail(
  inputEmail: string,
  registeredEmail: string
): { matched: boolean; message: string } {
  const cleanInput = inputEmail.trim().toLowerCase();
  const cleanRegistered = (registeredEmail || '').trim().toLowerCase();

  if (!isValidEmail(cleanInput)) {
    return {
      matched: false,
      message: 'Format email tidak valid.'
    };
  }

  if (cleanInput === cleanRegistered) {
    return {
      matched: true,
      message: 'Email terverifikasi. Pemulihan PIN siap dilakukan.'
    };
  }

  // Pesan aman, tidak membocorkan email yang terdaftar
  return {
    matched: false,
    message: 'Email tidak cocok dengan email yang terdaftar.'
  };
}

/**
 * Abstraksi proses ubah PIN:
 * 1. PIN saat ini wajib benar.
 * 2. PIN baru wajib diisi dan format valid (4-6 digit).
 * 3. PIN baru dan konfirmasi harus sama.
 */
export function verifyAndChangePin(
  currentInputPin: string,
  storedPin: string,
  newPin: string,
  confirmPin: string
): { success: boolean; message: string } {
  if (!currentInputPin) {
    return { success: false, message: 'PIN saat ini wajib diisi.' };
  }
  if (currentInputPin !== storedPin) {
    return { success: false, message: 'PIN saat ini tidak sesuai.' };
  }

  const pinValidation = validatePinFormat(newPin);
  if (!pinValidation.valid) {
    return { success: false, message: pinValidation.message || 'Format PIN baru tidak valid.' };
  }

  if (newPin !== confirmPin) {
    return { success: false, message: 'Konfirmasi PIN baru tidak sama dengan PIN baru.' };
  }

  if (newPin === storedPin) {
    return { success: false, message: 'PIN baru tidak boleh sama dengan PIN saat ini.' };
  }

  return { success: true, message: 'PIN berhasil diubah.' };
}

/**
 * LOCAL DATE/TIME HELPERS (Waktu Lokal Indonesia)
 * Memastikan tanggal dan waktu menggunakan kalender lokal perangkat (WIB/WITA/WIT),
 * bukan UTC (mencegah date-shifting akibat perbedaan zona waktu).
 */

/**
 * Format tanggal lokal: 'YYYY-MM-DD'
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format waktu lokal: 'HH:mm'
 */
export function getLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format tanggal & jam lokal: 'YYYY-MM-DD HH:mm'
 */
export function getLocalDateTimeString(date: Date = new Date()): string {
  return `${getLocalDateString(date)} ${getLocalTimeString(date)}`;
}

