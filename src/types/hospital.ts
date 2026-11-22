import type { Timestamp } from 'firebase/firestore';

export type AppointmentStatusValue =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say' | '';

export interface Department {
  id: string;
  name: string;
  summary: string;
  careScope: string;
  is24x7: boolean;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: Timestamp | unknown;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  departmentId: string;
  opdFee: number;
  isAvailable: boolean;
  availableSlots: string[];
  sortOrder: number;
  updatedAt?: Timestamp | unknown;
}

export interface BookedSlot {
  id?: string;
  doctorId: string;
  appointmentDate: string;
  timeSlot: string;
  appointmentId: string;
  status: 'active';
  createdAt?: Timestamp | unknown;
}

export interface Appointment {
  id: string;
  bookingId: string;
  patientName: string;
  mobileNumber: string;
  age: number;
  gender: GenderOption;
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  opdFee: number;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  status: AppointmentStatusValue;
  slotLockId: string;
  statusLookupId: string;
  adminNote: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AppointmentStatusRecord {
  bookingId: string;
  appointmentId: string;
  patientInitials: string;
  departmentName: string;
  doctorName: string;
  opdFee: number;
  appointmentDate: string;
  timeSlot: string;
  status: AppointmentStatusValue;
  adminNote: string;
  updatedAt?: Timestamp | null;
}

export type HospitalView =
  | 'home'
  | 'departments'
  | 'doctors'
  | 'book'
  | 'status'
  | 'about'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'admin';
