import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';
import { storage } from '../lib/firebase';

export interface ProcessedScreenshot {
  screenshotDataUrl: string;
  screenshotUrl: string;
}

export interface LocalPatientRecordRef {
  refId: string;
  kind: 'appointment' | 'payment';
  bookingId?: string;
  paymentRef?: string;
  mobileNumber: string;
  doctorName?: string;
  appointmentDate?: string;
  timeSlot?: string;
  amount?: number;
  createdAtIso: string;
}

const LOCAL_PATIENT_REFS_KEY = 'spinex_patient_portal_refs_v1';

export function normalizeTransactionId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export async function processPaymentScreenshot(
  file: File,
  filePrefix: string,
  ownerUid = ''
): Promise<ProcessedScreenshot> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WEBP screenshot image.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Screenshot image must be smaller than 10 MB.');
  }

  const { blob, dataUrl } = await compressImageForReceipt(file);

  let screenshotUrl = '';
  try {
    const safePrefix = filePrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'receipt';
    const objectRef = storageRef(storage, `payment-screenshots/${safePrefix}-${Date.now()}.jpg`);
    const uploadPromise = (async () => {
      await uploadBytes(objectRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: { ownerUid },
      });
      return await getDownloadURL(objectRef);
    })();

    screenshotUrl = await Promise.race<string>([
      uploadPromise,
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 2500)),
    ]);
  } catch {
    // Graceful fallback: compressed screenshotDataUrl is stored securely in Firestore
    screenshotUrl = '';
  }

  return {
    screenshotDataUrl: dataUrl,
    screenshotUrl,
  };
}

function compressImageForReceipt(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected screenshot file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const maxWidth = 960;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser image processing unavailable.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 135000 && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 145000) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.round(width * 0.7);
          smallCanvas.height = Math.round(height * 0.7);
          const sctx = smallCanvas.getContext('2d');
          if (sctx) {
            sctx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
            dataUrl = smallCanvas.toDataURL('image/jpeg', 0.65);
          }
        }

        const binary = atob(dataUrl.split(',')[1] || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        resolve({ blob, dataUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function saveLocalPatientRecordRef(item: LocalPatientRecordRef): void {
  try {
    const existing = getLocalPatientRecordRefs().filter(
      (r) => !(r.refId === item.refId && r.kind === item.kind)
    );
    const updated = [item, ...existing].slice(0, 25);
    window.localStorage.setItem(LOCAL_PATIENT_REFS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage restriction
  }
}

export function getLocalPatientRecordRefs(): LocalPatientRecordRef[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_PATIENT_REFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalPatientRecordRef =>
        Boolean(item) &&
        typeof item.refId === 'string' &&
        typeof item.mobileNumber === 'string' &&
        (item.kind === 'appointment' || item.kind === 'payment')
    );
  } catch {
    return [];
  }
}

export function removeLocalPatientRecordRef(refId: string, kind: 'appointment' | 'payment'): void {
  try {
    const updated = getLocalPatientRecordRefs().filter(
      (r) => !(r.refId === refId && r.kind === kind)
    );
    window.localStorage.setItem(LOCAL_PATIENT_REFS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function buildPaymentWhatsAppHref(params: {
  paymentRef: string;
  amount: number;
  transactionId: string;
  patientName: string;
  bookingId?: string;
}): string {
  const cleanPhone = HOSPITAL_INFO.phone.replace(/\D/g, '');
  const phone = cleanPhone.startsWith('977') ? cleanPhone : `977${cleanPhone}`;
  const bookingLine = params.bookingId ? ` (Booking ID: ${params.bookingId})` : '';
  const message = `Namaste Spine X Hospital Accounts Desk, I have submitted a Fonepay QR payment.\nPayment Ref: ${params.paymentRef}${bookingLine}\nPatient: ${params.patientName}\nAmount: NPR ${params.amount}\nTransaction ID: ${params.transactionId}\nPlease verify my payment.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildRefundWhatsAppHref(params: {
  refundRef: string;
  paymentRef: string;
  bookingId?: string;
  amount: number;
}): string {
  const cleanPhone = HOSPITAL_INFO.phone.replace(/\D/g, '');
  const phone = cleanPhone.startsWith('977') ? cleanPhone : `977${cleanPhone}`;
  const bookingLine = params.bookingId ? ` (Booking: ${params.bookingId})` : '';
  const message = `Namaste Spine X Hospital Desk, I submitted a refund request.\nRefund Ref: ${params.refundRef}\nPayment Ref: ${params.paymentRef}${bookingLine}\nAmount: NPR ${params.amount}\nCould you please share an update?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
