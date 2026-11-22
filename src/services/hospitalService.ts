import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_DEPARTMENTS, INITIAL_DOCTORS } from '../data/hospitalCatalog';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Appointment,
  AppointmentStatusRecord,
  AppointmentStatusValue,
  BookedSlot,
  Department,
  Doctor,
  GenderOption,
} from '../types/hospital';

export const VALIDATION_RULES = {
  bookingIdPattern: /^SXH-[0-9]{4}-[A-Z0-9]{6}$/,
  idPattern: /^[a-zA-Z0-9_-]{2,128}$/,
  mobilePattern: /^[0-9]{7,15}$/,
  datePattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  patientNameMin: 2,
  patientNameMax: 100,
  reasonMax: 500,
  adminNoteMax: 300,
} as const;

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

export async function computeStatusLookupId(
  bookingId: string,
  mobileNumber: string
): Promise<string> {
  const normalizedBooking = bookingId.trim().toUpperCase();
  const normalizedMobile = normalizeMobileNumber(mobileNumber);
  const encoder = new TextEncoder();
  const data = encoder.encode(`${normalizedBooking}:${normalizedMobile}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateBookingId(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `SXH-${year}-${suffix}`;
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
      departments = deptSnap.docs
        .map((d) => d.data() as Department)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
      doctors = docSnap.docs
        .map((d) => d.data() as Doctor)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
    const q = query(
      collection(db, 'bookedSlots'),
      where('status', '==', 'active')
    );
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

  const appointmentId = generateDocId('appt');
  const bookingId = generateBookingId();
  const slotLockId = buildSlotLockId(input.doctor.id, appointmentDate, timeSlot);
  const statusLookupId = await computeStatusLookupId(bookingId, mobileNumber);

  // Quick pre-check on slot lock so user gets immediate feedback before writeBatch
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
    departmentName: input.department.name.slice(0, 80),
    doctorId: input.doctor.id,
    doctorName: input.doctor.name.slice(0, 100),
    opdFee: Number(input.doctor.opdFee),
    appointmentDate,
    timeSlot,
    reason,
    status: 'pending',
    slotLockId,
    statusLookupId,
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  });

  batch.set(statusRef, {
    bookingId,
    appointmentId,
    patientInitials: getInitials(patientName),
    departmentName: input.department.name.slice(0, 80),
    doctorName: input.doctor.name.slice(0, 100),
    opdFee: Number(input.doctor.opdFee),
    appointmentDate,
    timeSlot,
    status: 'pending',
    adminNote: '',
    updatedAt: now,
  });

  try {
    await batch.commit();
    return {
      appointmentId,
      bookingId,
      patientName,
      mobileNumber,
      departmentName: input.department.name,
      doctorName: input.doctor.name,
      opdFee: Number(input.doctor.opdFee),
      appointmentDate,
      timeSlot,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission-denied') || msg.includes('already exists') || msg.includes('missing or insufficient permissions')) {
      // Re-check if slot became taken concurrently
      try {
        const recheck = await getDoc(slotRef);
        if (recheck.exists()) {
          throw new Error(
            `This time slot (${timeSlot}) was just booked by another patient. Please choose another open slot.`
          );
        }
      } catch (recheckErr) {
        if (recheckErr instanceof Error && recheckErr.message.includes('just booked')) {
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
          updatedAt: serverTimestamp(),
        });
      }
      wrote = true;
    }

    if (docSnap.empty) {
      for (const doctor of INITIAL_DOCTORS) {
        batch.set(doc(db, 'doctors', doctor.id), {
          ...doctor,
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

export async function updateAppointmentStatus(
  appointment: Appointment,
  nextStatus: AppointmentStatusValue,
  adminNote: string
): Promise<void> {
  const cleanNote = adminNote.trim().slice(0, VALIDATION_RULES.adminNoteMax);
  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.update(doc(db, 'appointments', appointment.id), {
    status: nextStatus,
    adminNote: cleanNote,
    updatedAt: now,
  });

  batch.update(doc(db, 'appointmentStatus', appointment.statusLookupId), {
    status: nextStatus,
    adminNote: cleanNote,
    updatedAt: now,
  });

  // Free slot lock when rejected or cancelled
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

  const payload: Doctor = {
    id: cleanId,
    name: doctor.name.trim().slice(0, 100),
    specialty: doctor.specialty.trim().slice(0, 100),
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
  const payload: Department = {
    id: cleanId,
    name: department.name.trim().slice(0, 80),
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
