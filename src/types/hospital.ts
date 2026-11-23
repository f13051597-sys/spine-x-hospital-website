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

export type PaymentCategory = 'general' | 'appointment';

export type PaymentMethod = 'fonepay_qr' | 'pay_at_desk';

export type PaymentVerificationStatus =
  | 'pending_verification'
  | 'verified'
  | 'rejected';

export type PaymentVerificationMode =
  | 'manual_pending'
  | 'manual_admin'
  | 'fonepay_api';

export type AppointmentPaymentStatus =
  | 'unpaid'
  | 'pending_verification'
  | 'verified'
  | 'rejected';

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export type RefundEligibilityType = 'standard_24h' | 'hospital_cancelled';

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
  paymentMethod?: PaymentMethod;
  paymentStatus?: AppointmentPaymentStatus;
  paymentId?: string;
  paymentRef?: string;
  transactionId?: string;
  ownerUid?: string;
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
  paymentMethod?: PaymentMethod;
  paymentStatus?: AppointmentPaymentStatus;
  paymentId?: string;
  paymentRef?: string;
  transactionId?: string;
  updatedAt?: Timestamp | null;
}

export interface PaymentRecord {
  id: string;
  paymentRef: string;
  paymentCategory: PaymentCategory;
  paymentMethod: PaymentMethod;
  patientName: string;
  mobileNumber: string;
  amount: number;
  transactionId: string;
  txLockId: string;
  purpose: string;
  bookingId: string;
  appointmentId: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  screenshotDataUrl: string;
  screenshotUrl: string;
  verificationStatus: PaymentVerificationStatus;
  verificationMode: PaymentVerificationMode;
  verifiedBy: string;
  rejectionReason: string;
  ownerUid: string;
  portalLookupId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  verifiedAt?: Timestamp | null;
}

export interface PaymentPortalRecord {
  paymentId: string;
  paymentRef: string;
  paymentCategory: PaymentCategory;
  patientInitials: string;
  amount: number;
  transactionId: string;
  purpose: string;
  bookingId: string;
  appointmentId: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  screenshotDataUrl: string;
  screenshotUrl: string;
  verificationStatus: PaymentVerificationStatus;
  rejectionReason: string;
  createdAtIso: string;
  updatedAt?: Timestamp | null;
  verifiedAt?: Timestamp | null;
}

export interface RefundRequest {
  id: string;
  refundRef: string;
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
  status: RefundStatus;
  refundTxRef: string;
  adminNote: string;
  processedBy: string;
  ownerUid: string;
  portalLookupId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  refundedAt?: Timestamp | null;
}

export interface RefundPortalRecord {
  refundId: string;
  refundRef: string;
  paymentId: string;
  paymentRef: string;
  bookingId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  amount: number;
  reason: string;
  eligibilityType: RefundEligibilityType;
  status: RefundStatus;
  refundTxRef: string;
  adminNote: string;
  createdAtIso: string;
  updatedAt?: Timestamp | null;
  refundedAt?: Timestamp | null;
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
  | 'pay'
  | 'dashboard'
  | 'status'
  | 'about'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'admin';
