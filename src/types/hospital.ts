import type { Timestamp } from 'firebase/firestore';

export type AppointmentStatusValue =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say' | '';

export type ReminderTiming =
  | '24_hours_before'
  | '2_hours_before'
  | 'morning_of_visit'
  | 'none';

export type ReminderChannel =
  | 'Calendar & Browser Alert'
  | 'WhatsApp Desk Reminder'
  | 'None';

export type ReminderStatus = 'pending' | 'sent' | 'not_needed';

export type FeedbackVisitType =
  | 'OPD Consultation'
  | 'Emergency / Trauma'
  | 'Inpatient Ward'
  | 'Diagnostics / Lab';

export interface Department {
  id: string;
  name: string;
  nepaliName?: string;
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
  qualification?: string;
  nmcNo?: string;
  opdSchedule?: string;
  photoUrl?: string;
  clinicalFocus?: string;
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
  reminderTiming?: ReminderTiming;
  reminderChannel?: ReminderChannel;
  reminderStatus?: ReminderStatus;
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
  reminderTiming?: ReminderTiming;
  reminderChannel?: ReminderChannel;
  reminderStatus?: ReminderStatus;
  updatedAt?: Timestamp | null;
}

export interface PatientFeedback {
  id: string;
  patientName: string;
  departmentName: string;
  doctorName: string;
  visitType: FeedbackVisitType;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt?: Timestamp | null;
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
