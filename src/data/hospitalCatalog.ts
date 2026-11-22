import type { Department, Doctor } from '../types/hospital';

export const HOSPITAL_INFO = {
  name: 'Spine X Superspeciality Hospital and Trauma Centre Pvt. Ltd.',
  shortName: 'Spine X Hospital',
  address: 'Birtamode, Jhapa, Nepal',
  phone: '9807923351',
  phoneHref: 'tel:9807923351',
  whatsappHref: 'https://wa.me/9779807923351',
  emergencyAvailability: '24/7 Emergency & Trauma Service',
  mapsQueryUrl:
    'https://www.google.com/maps/search/?api=1&query=Spine+X+Superspeciality+Hospital+and+Trauma+Centre+Birtamode+Jhapa+Nepal',
  mapsEmbedUrl:
    'https://maps.google.com/maps?q=Birtamode,+Jhapa,+Nepal&t=&z=14&ie=UTF8&iwloc=&output=embed',
} as const;

export const DEFAULT_OPD_SLOTS: string[] = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
];

export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'orthopedics',
    name: 'Orthopedics',
    summary:
      'Dedicated musculoskeletal, fracture, joint, and spine trauma evaluation and outpatient consultation.',
    careScope: 'Bone & Joint Care · Spine & Fracture Evaluation · Trauma Follow-Up',
    is24x7: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'emergency',
    name: 'Emergency',
    summary:
      'Round-the-clock acute trauma stabilization, emergency triage, and immediate medical response.',
    careScope: '24/7 Trauma Triage · Acute Stabilization · Direct Ambulance Reception',
    is24x7: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'icu',
    name: 'ICU',
    summary:
      'Continuous critical care monitoring and life-support inpatient management for high-acuity patients.',
    careScope: '24/7 Critical Monitoring · Post-Operative Intensive Care · Multi-Parameter Support',
    is24x7: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'medicine-ward',
    name: 'Medicine Ward',
    summary:
      'Inpatient internal medicine observation, acute illness care, and physician-guided recovery.',
    careScope: 'Inpatient Medical Care · Physician Rounds · Diagnostic Observation',
    is24x7: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'surgery-ward',
    name: 'Surgery Ward',
    summary:
      'Pre-operative preparation and structured post-surgical inpatient nursing and recovery.',
    careScope: 'Pre-Op Assessment · Post-Surgical Inpatient Care · Wound & Recovery Management',
    is24x7: true,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'gynecology-ward',
    name: 'Gynecology Ward',
    summary:
      'Dedicated women’s health inpatient ward supporting gynecological care and clinical monitoring.',
    careScope: 'Gynecology Inpatient Care · Clinical Monitoring · Consultation Support',
    is24x7: true,
    isActive: true,
    sortOrder: 6,
  },
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'dr-kumud-limbu',
    name: 'Dr. Kumud Kumar Limbu',
    specialty: '',
    departmentId: 'orthopedics',
    opdFee: 400,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 1,
  },
  {
    id: 'dr-keshar-bahadur-gurung',
    name: 'Dr. Keshar Bahadur Gurung',
    specialty: 'Physician',
    departmentId: 'medicine-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 2,
  },
  {
    id: 'dr-sachin-silapkar',
    name: 'Dr. Sachin Silapkar',
    specialty: 'ENT Specialist',
    departmentId: 'surgery-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 3,
  },
  {
    id: 'dr-laxam-rana-magar',
    name: 'Dr. Laxam Rana Magar',
    specialty: 'General Surgeon',
    departmentId: 'surgery-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 4,
  },
  {
    id: 'dr-prem-bahadur-shahi',
    name: 'Dr. Prem Bahadur Shahi',
    specialty: '',
    departmentId: 'orthopedics',
    opdFee: 400,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 5,
  },
];

export const HOSPITAL_FAQS = [
  {
    question: 'How do I book an online OPD appointment at Spine X Hospital?',
    answer:
      'Open the Book OPD page, enter your name, mobile number, and age, select the department and consultant doctor, choose an appointment date and an open time slot, and submit. You will immediately receive a unique Booking ID (e.g., SXH-2026-XXXXXX).',
  },
  {
    question: 'How can I check if my appointment has been approved?',
    answer:
      'Visit the Check Status page and enter both your Booking ID and the exact mobile number used during registration. Your live appointment status (Pending, Approved, Completed, Rejected, or Cancelled) and hospital notes will appear immediately.',
  },
  {
    question: 'Can two patients book the same doctor and time slot?',
    answer:
      'No. Each doctor, date, and time slot is locked atomically in our database upon booking. Booked slots appear unavailable immediately to prevent double-booking.',
  },
  {
    question: 'Is emergency and trauma care available at night and on holidays?',
    answer:
      'Yes. Spine X Superspeciality Hospital and Trauma Centre Pvt. Ltd. operates 24/7 Emergency and ICU services in Birtamode, Jhapa. For urgent medical assistance, call 9807923351 directly.',
  },
  {
    question: 'How are OPD consultation fees paid?',
    answer:
      'OPD consultation fees (NPR 400 or NPR 500 depending on the consultant) are displayed transparently during booking and settled at the hospital OPD registration desk upon arrival.',
  },
  {
    question: 'How is my patient information protected?',
    answer:
      'Patient appointment details, mobile numbers, and visit notes are strictly restricted to authorized hospital administrators. Public visitors cannot browse or view other patients’ records.',
  },
];
