import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_DEPARTMENTS, INITIAL_DOCTORS } from '../data/hospitalCatalog';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Appointment,
  AppointmentPaymentStatus,
  AppointmentStatusRecord,
  AppointmentStatusValue,
  BookedSlot,
  Department,
  Doctor,
  FeedbackVisitType,
  GenderOption,
  PatientFeedback,
  PaymentMethod,
  PaymentPortalRecord,
  PaymentRecord,
  RefundEligibilityType,
  RefundPortalRecord,
  RefundRequest,
  RefundStatus,
  ReminderChannel,
  ReminderStatus,
  ReminderTiming,
} from '../types/hospital';
import { normalizeTransactionId } from '../utils/paymentUtils';

export const VALIDATION_RULES = {
  bookingIdPattern: /^SXH-[0-9]{4}-[A-Z0-9]{6}$/,
  paymentRefPattern: /^PAY-[0-9]{4}-[A-Z0-9]{6}$/,
  refundRefPattern: /^REF-[0-9]{4}-[A-Z0-9]{6}$/,
  txIdPattern: /^[A-Z0-9._-]{4,64}$/,
  idPattern: /^[a-zA-Z0-9_-]{2,128}$/,
  mobilePattern: /^[0-9]{7,15}$/,
  datePattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  patientNameMin: 2,
  patientNameMax: 100,
  reasonMax: 500,
  adminNoteMax: 300,
  feedbackCommentMin: 5,
  feedbackCommentMax: 500,
} as const;

const LEGACY_NON_OPD_DEPARTMENT_IDS = new Set(['emergency', 'icu']);

export function normalizeMobileNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('977') && digits.length === 13) {
    return digits.slice(3);
  }
  return digits;
}

export function sanitizeSlugId(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function buildSlotLockId(
  doctorId: string,
  appointmentDate: string,
  timeSlot: string
): string {
  const cleanSlot = timeSlot.replace(/[^a-zA-Z0-9]/g, '');
  return `${doctorId}_${appointmentDate}_${cleanSlot}`;
}

async function sha256Hex(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeStatusLookupId(
  bookingId: string,
  mobileNumber: string
): Promise<string> {
  const normalizedBooking = bookingId.trim().toUpperCase();
  const normalizedMobile = normalizeMobileNumber(mobileNumber);
  return sha256Hex(`${normalizedBooking}:${normalizedMobile}`);
}

export async function computeTxLockId(transactionId: string): Promise<string> {
  const normalizedTx = normalizeTransactionId(transactionId);
  return sha256Hex(`TX:${normalizedTx}`);
}

export async function computePaymentPortalLookupId(
  paymentRef: string,
  mobileNumber: string
): Promise<string> {
  const normalizedRef = paymentRef.trim().toUpperCase();
  const normalizedMobile = normalizeMobileNumber(mobileNumber);
  return sha256Hex(`PAY:${normalizedRef}:${normalizedMobile}`);
}

function generateReferenceCode(prefix: 'SXH' | 'PAY' | 'REF'): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${year}-${suffix}`;
}

export function generateBookingId(): string {
  return generateReferenceCode('SXH');
}

export function generatePaymentRef(): string {
  return generateReferenceCode('PAY');
}

export function generateRefundRef(): string {
  return generateReferenceCode('REF');
}

export function generateDocId(prefix: string): string {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}-${hex}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P.';
  return parts
    .slice(0, 3)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')
    .slice(0, 10);
}

function mergeDepartmentWithDefaults(dept: Department): Department {
  const baseline = INITIAL_DEPARTMENTS.find((d) => d.id === dept.id);
  if (!baseline) return dept;
  return {
    ...baseline,
    ...dept,
    nepaliName: dept.nepaliName !== undefined ? dept.nepaliName : baseline.nepaliName,
  };
}

function mergeDoctorWithDefaults(docItem: Doctor): Doctor {
  const baseline = INITIAL_DOCTORS.find((d) => d.id === docItem.id);
  if (!baseline) return docItem;
  return {
    ...baseline,
    ...docItem,
    name: docItem.name || baseline.name,
    specialty: docItem.specialty || baseline.specialty,
    qualification:
      docItem.qualification !== undefined ? docItem.qualification : baseline.qualification,
    nmcNo: docItem.nmcNo !== undefined ? docItem.nmcNo : baseline.nmcNo,
    opdSchedule:
      docItem.opdSchedule !== undefined ? docItem.opdSchedule : baseline.opdSchedule,
    photoUrl: docItem.photoUrl !== undefined ? docItem.photoUrl : baseline.photoUrl,
    clinicalFocus:
      docItem.clinicalFocus !== undefined ? docItem.clinicalFocus : baseline.clinicalFocus,
  };
}

export async function fetchPublicCatalog(includeInactive = false): Promise<{
  departments: Department[];
  doctors: Doctor[];
  fromFirestore: boolean;
}> {
  let departments: Department[] = [];
  let doctors: Doctor[] = [];
  let fromFirestore = false;

  try {
    const deptQuery = includeInactive
      ? query(collection(db, 'departments'))
      : query(collection(db, 'departments'), where('isActive', '==', true));
    const deptSnap = await getDocs(deptQuery);
    if (!deptSnap.empty) {
      const fetchedDepts = deptSnap.docs
        .map((d) => mergeDepartmentWithDefaults(d.data() as Department))
        .filter((d) => !LEGACY_NON_OPD_DEPARTMENT_IDS.has(d.id));

      const existingIds = new Set(fetchedDepts.map((d) => d.id));
      const missingCoreDepts = INITIAL_DEPARTMENTS.filter((d) => !existingIds.has(d.id));
      departments = [...fetchedDepts, ...missingCoreDepts].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      fromFirestore = true;
    }
  } catch (error) {
    console.warn('Department read fallback used:', error);
  }

  try {
    const docQuery = includeInactive
      ? query(collection(db, 'doctors'))
      : query(collection(db, 'doctors'), where('isAvailable', '==', true));
    const docSnap = await getDocs(docQuery);
    if (!docSnap.empty) {
      const fetchedDocs = docSnap.docs.map((d) => mergeDoctorWithDefaults(d.data() as Doctor));
      const existingDocIds = new Set(fetchedDocs.map((d) => d.id));
      const missingCoreDocs = INITIAL_DOCTORS.filter(
        (d) => !existingDocIds.has(d.id) && (includeInactive || d.isAvailable)
      );
      doctors = [...fetchedDocs, ...missingCoreDocs].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      fromFirestore = true;
    }
  } catch (error) {
    console.warn('Doctor read fallback used:', error);
  }

  return {
    departments:
      departments.length > 0
        ? departments
        : includeInactive
          ? INITIAL_DEPARTMENTS
          : INITIAL_DEPARTMENTS.filter((d) => d.isActive),
    doctors:
      doctors.length > 0
        ? doctors
        : includeInactive
          ? INITIAL_DOCTORS
          : INITIAL_DOCTORS.filter((d) => d.isAvailable),
    fromFirestore,
  };
}

export async function fetchBookedSlotsForDoctorDate(
  doctorId: string,
  appointmentDate: string
): Promise<BookedSlot[]> {
  if (!doctorId || !appointmentDate) return [];
  try {
    const q = query(collection(db, 'bookedSlots'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as BookedSlot) }))
      .filter(
        (slot) => slot.doctorId === doctorId && slot.appointmentDate === appointmentDate
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'bookedSlots');
  }
}

export async function checkTransactionIdAvailable(rawTxId: string): Promise<{
  available: boolean;
  normalizedTxId: string;
  txLockId: string;
}> {
  const normalizedTxId = normalizeTransactionId(rawTxId);
  if (!VALIDATION_RULES.txIdPattern.test(normalizedTxId)) {
    throw new Error(
      'Transaction ID must be 4 to 64 alphanumeric characters (letters, digits, ., _, -).'
    );
  }
  const txLockId = await computeTxLockId(normalizedTxId);
  try {
    const snap = await getDoc(doc(db, 'paymentTxLocks', txLockId));
    return {
      available: !snap.exists(),
      normalizedTxId,
      txLockId,
    };
  } catch {
    return {
      available: true,
      normalizedTxId,
      txLockId,
    };
  }
}

async function validatePaymentOnServer(payload: {
  patientName: string;
  mobileNumber: string;
  amount: number;
  transactionId: string;
  paymentCategory: 'general' | 'appointment';
  hasScreenshot: boolean;
}): Promise<void> {
  const resp = await fetch('/api/payments/validate-submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await resp.json().catch(() => ({}))) as { valid?: boolean; error?: string };
  if (!resp.ok || !data.valid) {
    throw new Error(data.error || 'Payment details did not pass validation.');
  }
}

export interface CreateGeneralPaymentInput {
  patientName: string;
  mobileNumber: string;
  amount: number;
  transactionId: string;
  purpose: string;
  bookingId?: string;
  screenshotDataUrl: string;
  screenshotUrl?: string;
  ownerUid?: string;
}

export interface GeneralPaymentConfirmation {
  paymentId: string;
  paymentRef: string;
  patientName: string;
  mobileNumber: string;
  amount: number;
  transactionId: string;
  purpose: string;
  bookingId: string;
  createdAtIso: string;
}

export async function createGeneralPayment(
  input: CreateGeneralPaymentInput
): Promise<GeneralPaymentConfirmation> {
  const patientName = input.patientName.trim().slice(0, VALIDATION_RULES.patientNameMax);
  const mobileNumber = normalizeMobileNumber(input.mobileNumber);
  const amount = Math.round(Number(input.amount));
  const purpose = input.purpose.trim().slice(0, 250) || 'Hospital Service / Bill Payment';
  const cleanBookingId = (input.bookingId || '').trim().toUpperCase();
  const normalizedTxId = normalizeTransactionId(input.transactionId);

  if (cleanBookingId && !VALIDATION_RULES.bookingIdPattern.test(cleanBookingId)) {
    throw new Error('Optional Booking ID must match SXH-YYYY-XXXXXX format.');
  }
  if (!input.screenshotDataUrl || input.screenshotDataUrl.length < 20) {
    throw new Error('Please upload your Fonepay payment confirmation screenshot.');
  }
  if (input.screenshotDataUrl.length > 220000) {
    throw new Error('Payment screenshot is too large. Please try another image.');
  }

  await validatePaymentOnServer({
    patientName,
    mobileNumber,
    amount,
    transactionId: normalizedTxId,
    paymentCategory: 'general',
    hasScreenshot: true,
  });

  const { available, txLockId } = await checkTransactionIdAvailable(normalizedTxId);
  if (!available) {
    throw new Error(
      `Transaction ID ${normalizedTxId} has already been submitted. Duplicate transaction IDs are not permitted.`
    );
  }

  const paymentId = generateDocId('pay');
  const paymentRef = generatePaymentRef();
  const portalLookupId = await computePaymentPortalLookupId(paymentRef, mobileNumber);
  const createdAtIso = new Date().toISOString();
  const now = serverTimestamp();

  const batch = writeBatch(db);
  const txLockRef = doc(db, 'paymentTxLocks', txLockId);
  const paymentDocRef = doc(db, 'payments', paymentId);
  const portalDocRef = doc(db, 'paymentPortals', portalLookupId);

  batch.set(txLockRef, {
    transactionId: normalizedTxId,
    paymentId,
    paymentRef,
    createdAt: now,
  });

  batch.set(paymentDocRef, {
    paymentRef,
    paymentCategory: 'general',
    paymentMethod: 'fonepay_qr',
    patientName,
    mobileNumber,
    amount,
    transactionId: normalizedTxId,
    txLockId,
    purpose,
    bookingId: cleanBookingId,
    appointmentId: '',
    doctorName: '',
    departmentName: '',
    appointmentDate: '',
    timeSlot: '',
    screenshotDataUrl: input.screenshotDataUrl,
    screenshotUrl: (input.screenshotUrl || '').slice(0, 600),
    verificationStatus: 'pending_verification',
    verificationMode: 'manual_pending',
    verifiedBy: '',
    rejectionReason: '',
    ownerUid: input.ownerUid || '',
    portalLookupId,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(portalDocRef, {
    paymentId,
    paymentRef,
    paymentCategory: 'general',
    patientInitials: getInitials(patientName),
    amount,
    transactionId: normalizedTxId,
    purpose,
    bookingId: cleanBookingId,
    appointmentId: '',
    doctorName: '',
    departmentName: '',
    appointmentDate: '',
    timeSlot: '',
    screenshotDataUrl: input.screenshotDataUrl,
    screenshotUrl: (input.screenshotUrl || '').slice(0, 600),
    verificationStatus: 'pending_verification',
    rejectionReason: '',
    createdAtIso,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return {
      paymentId,
      paymentRef,
      patientName,
      mobileNumber,
      amount,
      transactionId: normalizedTxId,
      purpose,
      bookingId: cleanBookingId,
      createdAtIso,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('already exists')) {
      try {
        const recheck = await getDoc(txLockRef);
        if (recheck.exists()) {
          throw new Error(
            `Transaction ID ${normalizedTxId} has already been used for a previous submission.`
          );
        }
      } catch (inner) {
        if (inner instanceof Error && inner.message.includes('already been used')) {
          throw inner;
        }
      }
    }
    handleFirestoreError(error, OperationType.WRITE, `payments/${paymentId}`);
  }
}

export interface CreateAppointmentInput {
  patientName: string;
  mobileNumber: string;
  age: number;
  gender: GenderOption;
  department: Department;
  doctor: Doctor;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  reminderTiming: ReminderTiming;
  reminderChannel: ReminderChannel;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  screenshotDataUrl?: string;
  screenshotUrl?: string;
  ownerUid?: string;
}

export interface BookingConfirmation {
  appointmentId: string;
  bookingId: string;
  patientName: string;
  mobileNumber: string;
  departmentName: string;
  doctorName: string;
  opdFee: number;
  appointmentDate: string;
  timeSlot: string;
  reminderTiming: ReminderTiming;
  reminderChannel: ReminderChannel;
  paymentMethod: PaymentMethod;
  paymentStatus: AppointmentPaymentStatus;
  paymentId?: string;
  paymentRef?: string;
  transactionId?: string;
}

export async function createAppointmentBooking(
  input: CreateAppointmentInput
): Promise<BookingConfirmation> {
  const patientName = input.patientName.trim().slice(0, VALIDATION_RULES.patientNameMax);
  const mobileNumber = normalizeMobileNumber(input.mobileNumber);
  const age = Math.round(Number(input.age));
  const reason = input.reason.trim().slice(0, VALIDATION_RULES.reasonMax);
  const appointmentDate = input.appointmentDate.trim();
  const timeSlot = input.timeSlot.trim();
  const opdFee = Number(input.doctor.opdFee) || 0;
  const paymentMethod: PaymentMethod =
    input.paymentMethod === 'fonepay_qr' && opdFee >= 10 ? 'fonepay_qr' : 'pay_at_desk';

  if (patientName.length < VALIDATION_RULES.patientNameMin) {
    throw new Error('Please enter the patient full name (at least 2 characters).');
  }
  if (!VALIDATION_RULES.mobilePattern.test(mobileNumber)) {
    throw new Error('Please enter a valid 7 to 15 digit mobile number.');
  }
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    throw new Error('Please enter a valid patient age between 0 and 120.');
  }
  if (!VALIDATION_RULES.datePattern.test(appointmentDate)) {
    throw new Error('Please select a valid appointment date.');
  }
  if (timeSlot.length < 3 || timeSlot.length > 20) {
    throw new Error('Please select an available time slot.');
  }

  let paymentId = '';
  let paymentRef = '';
  let normalizedTxId = '';
  let txLockId = '';
  let portalLookupId = '';

  if (paymentMethod === 'fonepay_qr') {
    normalizedTxId = normalizeTransactionId(input.transactionId || '');
    if (!input.screenshotDataUrl || input.screenshotDataUrl.length < 20) {
      throw new Error('Please upload your Fonepay QR payment screenshot.');
    }
    if (input.screenshotDataUrl.length > 220000) {
      throw new Error('Payment screenshot is too large. Please try another image.');
    }

    await validatePaymentOnServer({
      patientName,
      mobileNumber,
      amount: opdFee,
      transactionId: normalizedTxId,
      paymentCategory: 'appointment',
      hasScreenshot: true,
    });

    const txCheck = await checkTransactionIdAvailable(normalizedTxId);
    if (!txCheck.available) {
      throw new Error(
        `Transaction ID ${normalizedTxId} has already been submitted. Duplicate transaction IDs are not permitted.`
      );
    }
    txLockId = txCheck.txLockId;
    paymentId = generateDocId('pay');
    paymentRef = generatePaymentRef();
    portalLookupId = await computePaymentPortalLookupId(paymentRef, mobileNumber);
  }

  const appointmentId = generateDocId('appt');
  const bookingId = generateBookingId();
  const slotLockId = buildSlotLockId(input.doctor.id, appointmentDate, timeSlot);
  const statusLookupId = await computeStatusLookupId(bookingId, mobileNumber);
  const reminderTiming: ReminderTiming = input.reminderTiming || '24_hours_before';
  const reminderChannel: ReminderChannel =
    reminderTiming === 'none' ? 'None' : input.reminderChannel || 'Calendar & Browser Alert';
  const reminderStatus: ReminderStatus = reminderTiming === 'none' ? 'not_needed' : 'pending';
  const paymentStatus: AppointmentPaymentStatus =
    paymentMethod === 'fonepay_qr' ? 'pending_verification' : 'unpaid';

  const slotRef = doc(db, 'bookedSlots', slotLockId);
  try {
    const existingSlot = await getDoc(slotRef);
    if (existingSlot.exists()) {
      throw new Error(
        `The ${timeSlot} slot for ${input.doctor.name} on ${appointmentDate} is already booked. Please choose another slot.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already booked')) {
      throw err;
    }
  }

  const batch = writeBatch(db);
  const appointmentRef = doc(db, 'appointments', appointmentId);
  const statusRef = doc(db, 'appointmentStatus', statusLookupId);
  const now = serverTimestamp();

  batch.set(slotRef, {
    doctorId: input.doctor.id,
    appointmentDate,
    timeSlot,
    appointmentId,
    status: 'active',
    createdAt: now,
  });

  batch.set(appointmentRef, {
    bookingId,
    patientName,
    mobileNumber,
    age,
    gender: input.gender || '',
    departmentId: input.department.id,
    departmentName: input.department.name.slice(0, 100),
    doctorId: input.doctor.id,
    doctorName: input.doctor.name.slice(0, 100),
    opdFee,
    appointmentDate,
    timeSlot,
    reason,
    status: 'pending',
    slotLockId,
    statusLookupId,
    adminNote: '',
    reminderTiming,
    reminderChannel,
    reminderStatus,
    paymentMethod,
    paymentStatus,
    paymentId,
    paymentRef,
    transactionId: normalizedTxId,
    ownerUid: input.ownerUid || '',
    createdAt: now,
    updatedAt: now,
  });

  batch.set(statusRef, {
    bookingId,
    appointmentId,
    patientInitials: getInitials(patientName),
    departmentName: input.department.name.slice(0, 100),
    doctorName: input.doctor.name.slice(0, 100),
    opdFee,
    appointmentDate,
    timeSlot,
    status: 'pending',
    adminNote: '',
    reminderTiming,
    reminderChannel,
    reminderStatus,
    paymentMethod,
    paymentStatus,
    paymentId,
    paymentRef,
    transactionId: normalizedTxId,
    updatedAt: now,
  });

  if (paymentMethod === 'fonepay_qr') {
    const createdAtIso = new Date().toISOString();
    batch.set(doc(db, 'paymentTxLocks', txLockId), {
      transactionId: normalizedTxId,
      paymentId,
      paymentRef,
      createdAt: now,
    });

    batch.set(doc(db, 'payments', paymentId), {
      paymentRef,
      paymentCategory: 'appointment',
      paymentMethod: 'fonepay_qr',
      patientName,
      mobileNumber,
      amount: opdFee,
      transactionId: normalizedTxId,
      txLockId,
      purpose: `OPD Appointment — ${input.doctor.name}`.slice(0, 250),
      bookingId,
      appointmentId,
      doctorName: input.doctor.name.slice(0, 100),
      departmentName: input.department.name.slice(0, 100),
      appointmentDate,
      timeSlot,
      screenshotDataUrl: input.screenshotDataUrl || '',
      screenshotUrl: (input.screenshotUrl || '').slice(0, 600),
      verificationStatus: 'pending_verification',
      verificationMode: 'manual_pending',
      verifiedBy: '',
      rejectionReason: '',
      ownerUid: input.ownerUid || '',
      portalLookupId,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'paymentPortals', portalLookupId), {
      paymentId,
      paymentRef,
      paymentCategory: 'appointment',
      patientInitials: getInitials(patientName),
      amount: opdFee,
      transactionId: normalizedTxId,
      purpose: `OPD Appointment — ${input.doctor.name}`.slice(0, 250),
      bookingId,
      appointmentId,
      doctorName: input.doctor.name.slice(0, 100),
      departmentName: input.department.name.slice(0, 100),
      appointmentDate,
      timeSlot,
      screenshotDataUrl: input.screenshotDataUrl || '',
      screenshotUrl: (input.screenshotUrl || '').slice(0, 600),
      verificationStatus: 'pending_verification',
      rejectionReason: '',
      createdAtIso,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
    return {
      appointmentId,
      bookingId,
      patientName,
      mobileNumber,
      departmentName: input.department.name,
      doctorName: input.doctor.name,
      opdFee,
      appointmentDate,
      timeSlot,
      reminderTiming,
      reminderChannel,
      paymentMethod,
      paymentStatus,
      paymentId: paymentId || undefined,
      paymentRef: paymentRef || undefined,
      transactionId: normalizedTxId || undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      msg.includes('permission-denied') ||
      msg.includes('already exists') ||
      msg.includes('missing or insufficient permissions')
    ) {
      try {
        const recheckSlot = await getDoc(slotRef);
        if (recheckSlot.exists()) {
          throw new Error(
            `This time slot (${timeSlot}) was just booked by another patient. Please choose another open slot.`
          );
        }
        if (txLockId) {
          const recheckTx = await getDoc(doc(db, 'paymentTxLocks', txLockId));
          if (recheckTx.exists()) {
            throw new Error(
              `Transaction ID ${normalizedTxId} was already submitted. Please verify your Fonepay trace ID.`
            );
          }
        }
      } catch (recheckErr) {
        if (
          recheckErr instanceof Error &&
          (recheckErr.message.includes('just booked') ||
            recheckErr.message.includes('already submitted'))
        ) {
          throw recheckErr;
        }
      }
    }
    handleFirestoreError(error, OperationType.WRITE, `appointments/${appointmentId}`);
  }
}

export async function lookupAppointmentStatus(
  bookingId: string,
  mobileNumber: string
): Promise<AppointmentStatusRecord | null> {
  const cleanBookingId = bookingId.trim().toUpperCase();
  const cleanMobile = normalizeMobileNumber(mobileNumber);

  if (!VALIDATION_RULES.bookingIdPattern.test(cleanBookingId)) {
    throw new Error('Booking ID must follow the format SXH-YYYY-XXXXXX.');
  }
  if (!VALIDATION_RULES.mobilePattern.test(cleanMobile)) {
    throw new Error('Please enter the 7 to 15 digit mobile number used during booking.');
  }

  const lookupId = await computeStatusLookupId(cleanBookingId, cleanMobile);
  const path = `appointmentStatus/${lookupId}`;
  try {
    const snap = await getDoc(doc(db, 'appointmentStatus', lookupId));
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as AppointmentStatusRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function lookupPaymentPortalRecord(
  paymentRef: string,
  mobileNumber: string
): Promise<PaymentPortalRecord | null> {
  const cleanRef = paymentRef.trim().toUpperCase();
  const cleanMobile = normalizeMobileNumber(mobileNumber);

  if (!VALIDATION_RULES.paymentRefPattern.test(cleanRef)) {
    throw new Error('Payment Ref must follow the format PAY-YYYY-XXXXXX.');
  }
  if (!VALIDATION_RULES.mobilePattern.test(cleanMobile)) {
    throw new Error('Please enter the 7 to 15 digit mobile number used during payment.');
  }

  const lookupId = await computePaymentPortalLookupId(cleanRef, cleanMobile);
  try {
    const snap = await getDoc(doc(db, 'paymentPortals', lookupId));
    return snap.exists() ? (snap.data() as PaymentPortalRecord) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `paymentPortals/${lookupId}`);
  }
}

export async function lookupRefundPortalRecord(
  paymentRef: string,
  mobileNumber: string
): Promise<RefundPortalRecord | null> {
  const cleanRef = paymentRef.trim().toUpperCase();
  const cleanMobile = normalizeMobileNumber(mobileNumber);
  if (!VALIDATION_RULES.paymentRefPattern.test(cleanRef)) {
    return null;
  }
  const lookupId = await computePaymentPortalLookupId(cleanRef, cleanMobile);
  try {
    const snap = await getDoc(doc(db, 'refundPortals', lookupId));
    return snap.exists() ? (snap.data() as RefundPortalRecord) : null;
  } catch {
    return null;
  }
}

export async function lookupPatientBundleByRef(
  refId: string,
  mobileNumber: string
): Promise<{
  appointmentStatus: AppointmentStatusRecord | null;
  paymentPortal: PaymentPortalRecord | null;
  refundPortal: RefundPortalRecord | null;
}> {
  const cleanRef = refId.trim().toUpperCase();
  const cleanMobile = normalizeMobileNumber(mobileNumber);

  if (!VALIDATION_RULES.mobilePattern.test(cleanMobile)) {
    throw new Error('Please enter a valid 7 to 15 digit registered mobile number.');
  }

  if (VALIDATION_RULES.bookingIdPattern.test(cleanRef)) {
    const appointmentStatus = await lookupAppointmentStatus(cleanRef, cleanMobile);
    let paymentPortal: PaymentPortalRecord | null = null;
    let refundPortal: RefundPortalRecord | null = null;
    if (appointmentStatus?.paymentRef) {
      paymentPortal = await lookupPaymentPortalRecord(
        appointmentStatus.paymentRef,
        cleanMobile
      );
      refundPortal = await lookupRefundPortalRecord(appointmentStatus.paymentRef, cleanMobile);
    }
    return { appointmentStatus, paymentPortal, refundPortal };
  }

  if (VALIDATION_RULES.paymentRefPattern.test(cleanRef)) {
    const [paymentPortal, refundPortal] = await Promise.all([
      lookupPaymentPortalRecord(cleanRef, cleanMobile),
      lookupRefundPortalRecord(cleanRef, cleanMobile),
    ]);
    let appointmentStatus: AppointmentStatusRecord | null = null;
    if (paymentPortal?.bookingId && VALIDATION_RULES.bookingIdPattern.test(paymentPortal.bookingId)) {
      appointmentStatus = await lookupAppointmentStatus(paymentPortal.bookingId, cleanMobile);
    }
    return { appointmentStatus, paymentPortal, refundPortal };
  }

  throw new Error(
    'Reference ID must be an Appointment Booking ID (SXH-YYYY-XXXXXX) or Payment Ref (PAY-YYYY-XXXXXX).'
  );
}

export async function fetchSignedInPatientRecords(uid: string): Promise<{
  appointments: Appointment[];
  payments: PaymentRecord[];
  refunds: RefundRequest[];
}> {
  try {
    const [apptSnap, paySnap, refSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), where('ownerUid', '==', uid))),
      getDocs(query(collection(db, 'payments'), where('ownerUid', '==', uid))),
      getDocs(query(collection(db, 'refunds'), where('ownerUid', '==', uid))),
    ]);

    const sortByCreatedDesc = <T extends { createdAt?: { toMillis?: () => number } | null }>(
      items: T[]
    ) =>
      items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    return {
      appointments: sortByCreatedDesc(
        apptSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
      ),
      payments: sortByCreatedDesc(
        paySnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }))
      ),
      refunds: sortByCreatedDesc(
        refSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RefundRequest, 'id'>) }))
      ),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `patient/${uid}`);
  }
}

export async function validateRefundEligibility(params: {
  appointmentDate: string;
  timeSlot: string;
  appointmentStatus: string;
  paymentVerificationStatus: string;
  amount: number;
}): Promise<{
  eligible: boolean;
  refundPercentage: number;
  eligibilityType: RefundEligibilityType | null;
  hoursUntilAppointment: number | null;
  reason: string;
}> {
  const resp = await fetch('/api/refunds/validate-eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    eligible?: boolean;
    refundPercentage?: number;
    eligibilityType?: RefundEligibilityType | null;
    hoursUntilAppointment?: number | null;
    reason?: string;
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(data.error || 'Could not validate refund eligibility.');
  }
  return {
    eligible: Boolean(data.eligible),
    refundPercentage: Number(data.refundPercentage || 0),
    eligibilityType: data.eligibilityType || null,
    hoursUntilAppointment:
      typeof data.hoursUntilAppointment === 'number' ? data.hoursUntilAppointment : null,
    reason: data.reason || '',
  };
}

export async function createRefundRequest(input: {
  paymentId: string;
  paymentRef: string;
  bookingId: string;
  appointmentId: string;
  patientName: string;
  mobileNumber: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  amount: number;
  reason: string;
  eligibilityType: RefundEligibilityType;
  ownerUid?: string;
}): Promise<{ refundId: string; refundRef: string }> {
  const cleanReason = input.reason.trim().slice(0, 500);
  const cleanMobile = normalizeMobileNumber(input.mobileNumber);

  if (cleanReason.length < 5) {
    throw new Error('Please enter a clear refund reason (at least 5 characters).');
  }
  if (!VALIDATION_RULES.mobilePattern.test(cleanMobile)) {
    throw new Error('Valid registered mobile number is required.');
  }

  // Check duplicate refund lock first
  const lockRef = doc(db, 'refundLocks', input.paymentId);
  try {
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists()) {
      throw new Error('A refund request has already been submitted for this payment.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already been submitted')) {
      throw err;
    }
  }

  const refundId = generateDocId('ref');
  const refundRef = generateRefundRef();
  const portalLookupId = await computePaymentPortalLookupId(input.paymentRef, cleanMobile);
  const createdAtIso = new Date().toISOString();
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(lockRef, {
    paymentId: input.paymentId,
    refundId,
    createdAt: now,
  });

  batch.set(doc(db, 'refunds', refundId), {
    refundRef,
    paymentId: input.paymentId,
    paymentRef: input.paymentRef,
    bookingId: input.bookingId || '',
    appointmentId: input.appointmentId || '',
    patientName: input.patientName.trim().slice(0, 100) || 'Patient',
    mobileNumber: cleanMobile,
    doctorName: (input.doctorName || '').slice(0, 100),
    departmentName: (input.departmentName || '').slice(0, 100),
    appointmentDate: input.appointmentDate || '',
    timeSlot: (input.timeSlot || '').slice(0, 20),
    amount: Number(input.amount),
    reason: cleanReason,
    eligibilityType: input.eligibilityType,
    status: 'pending',
    refundTxRef: '',
    adminNote: '',
    processedBy: '',
    ownerUid: input.ownerUid || '',
    portalLookupId,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, 'refundPortals', portalLookupId), {
    refundId,
    refundRef,
    paymentId: input.paymentId,
    paymentRef: input.paymentRef,
    bookingId: input.bookingId || '',
    doctorName: (input.doctorName || '').slice(0, 100),
    appointmentDate: input.appointmentDate || '',
    timeSlot: (input.timeSlot || '').slice(0, 20),
    amount: Number(input.amount),
    reason: cleanReason,
    eligibilityType: input.eligibilityType,
    status: 'pending',
    refundTxRef: '',
    adminNote: '',
    createdAtIso,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return { refundId, refundRef };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `refunds/${refundId}`);
  }
}

export async function fetchFonepayConfigStatus(): Promise<{
  merchantName: string;
  terminalId: string;
  branch: string;
  acquiredBy: string;
  apiConfigured: boolean;
  verificationMode: string;
}> {
  const resp = await fetch('/api/payments/fonepay/config');
  if (!resp.ok) {
    throw new Error('Unable to load Fonepay verification config.');
  }
  return resp.json();
}

export async function verifyPaymentWithFonepayApi(
  idToken: string,
  payment: PaymentRecord
): Promise<{
  verified: boolean;
  mode: string;
  message: string;
}> {
  const resp = await fetch('/api/payments/fonepay/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      paymentRef: payment.paymentRef,
      transactionId: payment.transactionId,
      amount: payment.amount,
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    verified?: boolean;
    mode?: string;
    message?: string;
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(data.error || 'Fonepay API verification request failed.');
  }
  return {
    verified: Boolean(data.verified),
    mode: data.mode || 'manual_admin_verification',
    message: data.message || '',
  };
}

export async function adminVerifyPayment(
  payment: PaymentRecord,
  mode: 'fonepay_api' | 'manual_admin',
  verifiedByEmail: string
): Promise<{ appointmentAutoApproved: boolean }> {
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(doc(db, 'payments', payment.id), {
    verificationStatus: 'verified',
    verificationMode: mode,
    verifiedBy: verifiedByEmail.slice(0, 160),
    rejectionReason: '',
    verifiedAt: now,
    updatedAt: now,
  });

  batch.update(doc(db, 'paymentPortals', payment.portalLookupId), {
    verificationStatus: 'verified',
    rejectionReason: '',
    verifiedAt: now,
    updatedAt: now,
  });

  let appointmentAutoApproved = false;
  if (payment.paymentCategory === 'appointment' && payment.appointmentId) {
    const apptRef = doc(db, 'appointments', payment.appointmentId);
    const apptSnap = await getDoc(apptRef);
    if (apptSnap.exists()) {
      const apptData = apptSnap.data() as Appointment;
      const shouldApprove = apptData.status === 'pending';
      const nextStatus: AppointmentStatusValue = shouldApprove ? 'approved' : apptData.status;
      const nextNote =
        apptData.adminNote ||
        (shouldApprove
          ? `Payment verified (${payment.paymentRef}) & appointment approved.`
          : '');

      batch.update(apptRef, {
        paymentStatus: 'verified',
        status: nextStatus,
        adminNote: nextNote.slice(0, 300),
        updatedAt: now,
      });

      batch.update(doc(db, 'appointmentStatus', apptData.statusLookupId), {
        paymentStatus: 'verified',
        status: nextStatus,
        adminNote: nextNote.slice(0, 300),
        updatedAt: now,
      });
      appointmentAutoApproved = shouldApprove;
    }
  }

  try {
    await batch.commit();
    return { appointmentAutoApproved };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
  }
}

export async function adminRejectPayment(
  payment: PaymentRecord,
  rejectionReason: string,
  verifiedByEmail: string
): Promise<void> {
  const cleanReason =
    rejectionReason.trim().slice(0, 300) ||
    'Transaction ID or screenshot could not be matched with hospital Fonepay statement.';
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.update(doc(db, 'payments', payment.id), {
    verificationStatus: 'rejected',
    verificationMode: 'manual_admin',
    verifiedBy: verifiedByEmail.slice(0, 160),
    rejectionReason: cleanReason,
    updatedAt: now,
  });

  batch.update(doc(db, 'paymentPortals', payment.portalLookupId), {
    verificationStatus: 'rejected',
    rejectionReason: cleanReason,
    updatedAt: now,
  });

  if (payment.paymentCategory === 'appointment' && payment.appointmentId) {
    const apptRef = doc(db, 'appointments', payment.appointmentId);
    const apptSnap = await getDoc(apptRef);
    if (apptSnap.exists()) {
      const apptData = apptSnap.data() as Appointment;
      batch.update(apptRef, {
        paymentStatus: 'rejected',
        adminNote: cleanReason,
        updatedAt: now,
      });
      batch.update(doc(db, 'appointmentStatus', apptData.statusLookupId), {
        paymentStatus: 'rejected',
        adminNote: cleanReason,
        updatedAt: now,
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
  }
}

export async function adminUpdateRefundStatus(
  refund: RefundRequest,
  nextStatus: RefundStatus,
  adminNote: string,
  refundTxRef: string,
  processedByEmail: string
): Promise<void> {
  const cleanNote = adminNote.trim().slice(0, 300);
  const cleanRefundTxRef = refundTxRef.trim().slice(0, 100);

  if (nextStatus === 'refunded' && cleanRefundTxRef.length < 3) {
    throw new Error(
      'To mark a refund as Refunded, please enter the actual bank / Fonepay Refund Transaction Reference.'
    );
  }

  const now = serverTimestamp();
  const batch = writeBatch(db);

  const refundPatch: Record<string, unknown> = {
    status: nextStatus,
    adminNote: cleanNote,
    refundTxRef: cleanRefundTxRef,
    processedBy: processedByEmail.slice(0, 160),
    updatedAt: now,
  };
  const portalPatch: Record<string, unknown> = {
    status: nextStatus,
    adminNote: cleanNote,
    refundTxRef: cleanRefundTxRef,
    updatedAt: now,
  };

  if (nextStatus === 'refunded') {
    refundPatch.refundedAt = now;
    portalPatch.refundedAt = now;
  }

  batch.update(doc(db, 'refunds', refund.id), refundPatch);
  batch.update(doc(db, 'refundPortals', refund.portalLookupId), portalPatch);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `refunds/${refund.id}`);
  }
}

export async function seedCatalogIfEmpty(): Promise<boolean> {
  try {
    const [deptSnap, docSnap] = await Promise.all([
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'doctors')),
    ]);

    const batch = writeBatch(db);
    let wrote = false;

    if (deptSnap.empty) {
      for (const dept of INITIAL_DEPARTMENTS) {
        batch.set(doc(db, 'departments', dept.id), {
          ...dept,
          nepaliName: dept.nepaliName || '',
          updatedAt: serverTimestamp(),
        });
      }
      wrote = true;
    }

    if (docSnap.empty) {
      for (const doctor of INITIAL_DOCTORS) {
        batch.set(doc(db, 'doctors', doctor.id), {
          ...doctor,
          qualification: doctor.qualification || '',
          nmcNo: doctor.nmcNo || '',
          opdSchedule: doctor.opdSchedule || '',
          photoUrl: doctor.photoUrl || '',
          clinicalFocus: doctor.clinicalFocus || '',
          updatedAt: serverTimestamp(),
        });
      }
      wrote = true;
    }

    if (wrote) {
      await batch.commit();
    }
    return wrote;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalog/seed');
  }
}

export async function syncOfficialCatalogToFirestore(): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const dept of INITIAL_DEPARTMENTS) {
      batch.set(doc(db, 'departments', dept.id), {
        ...dept,
        nepaliName: dept.nepaliName || '',
        updatedAt: serverTimestamp(),
      });
    }
    for (const legacyId of LEGACY_NON_OPD_DEPARTMENT_IDS) {
      batch.delete(doc(db, 'departments', legacyId));
    }
    for (const doctor of INITIAL_DOCTORS) {
      batch.set(doc(db, 'doctors', doctor.id), {
        ...doctor,
        qualification: doctor.qualification || '',
        nmcNo: doctor.nmcNo || '',
        opdSchedule: doctor.opdSchedule || '',
        photoUrl: doctor.photoUrl || '',
        clinicalFocus: doctor.clinicalFocus || '',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalog/sync-official');
  }
}

export async function updateAppointmentStatus(
  appointment: Appointment,
  nextStatus: AppointmentStatusValue,
  adminNote: string,
  nextReminderStatus?: ReminderStatus
): Promise<void> {
  const cleanNote = adminNote.trim().slice(0, VALIDATION_RULES.adminNoteMax);
  const batch = writeBatch(db);
  const now = serverTimestamp();

  const apptPatch: Record<string, unknown> = {
    status: nextStatus,
    adminNote: cleanNote,
    updatedAt: now,
  };
  const statusPatch: Record<string, unknown> = {
    status: nextStatus,
    adminNote: cleanNote,
    updatedAt: now,
  };

  if (nextReminderStatus) {
    apptPatch.reminderStatus = nextReminderStatus;
    statusPatch.reminderStatus = nextReminderStatus;
  }

  batch.update(doc(db, 'appointments', appointment.id), apptPatch);
  batch.update(doc(db, 'appointmentStatus', appointment.statusLookupId), statusPatch);

  if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
    batch.delete(doc(db, 'bookedSlots', appointment.slotLockId));
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

export async function upsertDoctor(doctor: Doctor): Promise<void> {
  const cleanId = sanitizeSlugId(doctor.id || doctor.name);
  if (!VALIDATION_RULES.idPattern.test(cleanId)) {
    throw new Error('Invalid doctor identifier.');
  }
  const cleanSlots = doctor.availableSlots
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 20)
    .slice(0, 16);

  const payload = {
    id: cleanId,
    name: doctor.name.trim().slice(0, 100),
    specialty: doctor.specialty.trim().slice(0, 150),
    qualification: (doctor.qualification || '').trim().slice(0, 350),
    nmcNo: (doctor.nmcNo || '').trim().slice(0, 30),
    opdSchedule: (doctor.opdSchedule || '').trim().slice(0, 100),
    photoUrl: (doctor.photoUrl || '').trim().slice(0, 150000),
    clinicalFocus: (doctor.clinicalFocus || '').trim().slice(0, 500),
    departmentId: doctor.departmentId,
    opdFee: Math.max(0, Math.min(50000, Math.round(Number(doctor.opdFee) || 0))),
    isAvailable: Boolean(doctor.isAvailable),
    availableSlots: cleanSlots,
    sortOrder: Math.max(0, Math.min(1000, Math.round(Number(doctor.sortOrder) || 10))),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'doctors', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `doctors/${cleanId}`);
  }
}

export async function removeDoctor(doctorId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'doctors', doctorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `doctors/${doctorId}`);
  }
}

export async function upsertDepartment(department: Department): Promise<void> {
  const cleanId = sanitizeSlugId(department.id || department.name);
  if (!VALIDATION_RULES.idPattern.test(cleanId)) {
    throw new Error('Invalid department identifier.');
  }
  const payload = {
    id: cleanId,
    name: department.name.trim().slice(0, 100),
    nepaliName: (department.nepaliName || '').trim().slice(0, 120),
    summary: department.summary.trim().slice(0, 400),
    careScope: department.careScope.trim().slice(0, 400),
    is24x7: Boolean(department.is24x7),
    isActive: Boolean(department.isActive),
    sortOrder: Math.max(0, Math.min(1000, Math.round(Number(department.sortOrder) || 10))),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'departments', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `departments/${cleanId}`);
  }
}

export async function removeDepartment(departmentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'departments', departmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `departments/${departmentId}`);
  }
}

export async function fetchPublishedFeedback(): Promise<PatientFeedback[]> {
  try {
    const q = query(collection(db, 'feedback'), where('isPublished', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PatientFeedback, 'id'>) }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
  } catch (error) {
    console.warn('Could not load published feedback:', error);
    return [];
  }
}

export async function submitPatientFeedback(input: {
  patientName: string;
  departmentName: string;
  doctorName: string;
  visitType: FeedbackVisitType;
  rating: number;
  comment: string;
}): Promise<PatientFeedback> {
  const patientName = input.patientName.trim().slice(0, 80);
  const departmentName = input.departmentName.trim().slice(0, 100);
  const doctorName = input.doctorName.trim().slice(0, 100);
  const comment = input.comment.trim().slice(0, VALIDATION_RULES.feedbackCommentMax);
  const rating = Math.round(Number(input.rating));

  if (patientName.length < 2) {
    throw new Error('Please enter your name (at least 2 characters).');
  }
  if (departmentName.length < 2) {
    throw new Error('Please select the department or service visited.');
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Please select a star rating between 1 and 5.');
  }
  if (comment.length < VALIDATION_RULES.feedbackCommentMin) {
    throw new Error('Please enter a brief feedback message (at least 5 characters).');
  }

  const feedbackId = generateDocId('fb');
  const payload = {
    patientName,
    departmentName,
    doctorName,
    visitType: input.visitType,
    rating,
    comment,
    isPublished: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'feedback', feedbackId), payload);
    return {
      id: feedbackId,
      patientName,
      departmentName,
      doctorName,
      visitType: input.visitType,
      rating,
      comment,
      isPublished: true,
      createdAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `feedback/${feedbackId}`);
  }
}

export async function adminToggleFeedbackPublish(
  feedbackId: string,
  nextPublished: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'feedback', feedbackId), {
      isPublished: nextPublished,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `feedback/${feedbackId}`);
  }
}

export async function adminDeleteFeedback(feedbackId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'feedback', feedbackId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `feedback/${feedbackId}`);
  }
}
