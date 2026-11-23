import type { Department, Doctor } from '../types/hospital';

export const HOSPITAL_INFO = {
  name: 'Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd.',
  shortName: 'Spine X Hospital',
  address: 'Bhagwan Chowk, Birtamode-3, Jhapa, Nepal',
  phone: '9807923351',
  landlines: '023-591068 | 023-591069',
  phoneHref: 'tel:9807923351',
  landlineHref: 'tel:023591068',
  whatsappHref: 'https://wa.me/9779807923351',
  logoUrl: '/assets/aistudio/IMG_0016_2a550c0d.jpeg',
  emergencyAvailability: '24-Hour Emergency & Trauma Services',
  mapsQueryUrl:
    'https://www.google.com/maps/search/?api=1&query=Spine+X+Superspeciality+Hospital+and+Trauma+Centre+Bhagwan+Chowk+Birtamode+Jhapa+Nepal',
  mapsEmbedUrl:
    'https://maps.google.com/maps?q=Birtamode,+Jhapa,+Nepal&t=&z=14&ie=UTF8&iwloc=&output=embed',
} as const;

export const FONEPAY_MERCHANT_INFO = {
  qrImageUrl: '/assets/aistudio/IMG_0039_e983f86c.jpeg',
  merchantName: 'SPINE X. SUPERSPECIALITY HOSPITAL AND TRAUMA CENTER PRIVATE LIMITED',
  terminalId: '2222050014357399',
  branch: 'BIRTAMOD',
  acquiredBy: 'Siddhartha Bank',
  supportedNetworks: ['Fonepay', 'UPI', 'Alipay+', 'UnionPay'],
} as const;

export const HOSPITAL_PHOTOS = [
  {
    id: 'hospital-building',
    src: '/assets/aistudio/IMG_0029_8f3b2bd5.jpeg',
    title: 'Hospital Main Building',
    subtitle: 'Bhagwan Chowk, Birtamode-3, Jhapa',
    alt: 'Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd. multi-storey building exterior in Birtamode, Jhapa, Nepal',
    caption:
      'Main hospital complex housing specialized OPD clinics, surgical suites, ICU/NICU/PICU critical care, and inpatient wards.',
  },
  {
    id: 'emergency-entrance',
    src: '/assets/aistudio/IMG_0026_02de040b.jpeg',
    title: '24/7 Emergency Entrance & Pharmacy',
    subtitle: 'Emergency & Ambulance Zone',
    alt: '24/7 Emergency entrance, ambulance parking zone, and 24-hour Pharmacy at Spine X Hospital in Birtamode',
    caption:
      'Direct ambulance access bay leading to 24-Hour Emergency & Trauma triage alongside the 24-Hour Pharmacy.',
  },
  {
    id: 'emergency-ward-corridor',
    src: '/assets/aistudio/IMG_0028_b2db9118.jpeg',
    title: 'Hospital Wing & Patient Corridor',
    subtitle: 'Indoor Clinical Access',
    alt: 'Indoor directional signage inside Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd.',
    caption:
      'Guided indoor clinical corridor connecting Emergency & Trauma reception, outpatient consultation, and patient support services.',
  },
] as const;

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

/**
 * Departmental Services (#1 - #5 from Official Hospital Services List).
 * Emergency (#19), Daily OPD (#20), ICU (#10), and Medical Ward (#17) live strictly
 * in ServicesShowcase under "Other Services" & "Emergency and OPD" to ensure zero duplicates.
 */
export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'orthopedics',
    name: 'Orthopedic, Neurology and Spine Diseases',
    nepaliName: 'हाडजोर्नी, नशा तथा मेरुदण्ड रोग',
    summary:
      'Specialized evaluation and management of bone, joint, nerve, and spinal conditions including trauma and rheumatology care.',
    careScope: 'हाडजोर्नी, नशा तथा मेरुदण्ड रोग · Fracture & Spine Care · Joint Consultation',
    is24x7: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'gynecology-ward',
    name: 'Gynecology, Obstetrics and Infertility',
    nepaliName: 'स्त्री, प्रसूति रोग तथा बाँझोपन',
    summary:
      'Comprehensive women’s health, obstetric care, maternal monitoring, and infertility consultation services.',
    careScope: 'स्त्री, प्रसूति रोग तथा बाँझोपन · Antenatal & Postnatal Support · Gynecology Care',
    is24x7: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'neonatal-pediatrics',
    name: 'Neonatal and Pediatric Diseases',
    nepaliName: 'नवजात शिशु तथा बाल रोग',
    summary:
      'Dedicated newborn healthcare, pediatric illness management, respiratory care, and child growth and nutrition counseling.',
    careScope: 'नवजात शिशु तथा बाल रोग · Newborn Care · Pediatric Health & Nutrition',
    is24x7: false,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'medicine-ward',
    name: 'Stomach, Chest, Heart, Diabetes and Rheumatology Diseases',
    nepaliName: 'पेट, छाती, मुटु, मधुमेह तथा बाथ रोग',
    summary:
      'Internal medicine consultations covering gastrointestinal, respiratory, cardiac, endocrine (diabetes), and rheumatological conditions.',
    careScope: 'पेट, छाती, मुटु, मधुमेह तथा बाथ रोग · Physician Consultation · Chronic Disease Care',
    is24x7: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'surgery-ward',
    name: 'Surgical Services in All Departments',
    nepaliName: 'सम्पूर्ण विभागको सर्जरी सेवा',
    summary:
      'General, laparoscopic, orthopedic, spine, ENT, and multi-department surgical evaluation and operative management.',
    careScope: 'सम्पूर्ण विभागको सर्जरी सेवा · General & Laparoscopic Surgery · ENT & Specialty Operations',
    is24x7: true,
    isActive: true,
    sortOrder: 5,
  },
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'dr-kumud-limbu',
    name: 'Dr. Kumud Kumar Limbu',
    specialty: 'Senior Orthopedic & Rheumatology Specialist (वरिष्ठ हाड जोर्नी तथा बाथ रोग विशेषज्ञ)',
    qualification: '',
    nmcNo: '',
    opdSchedule: '',
    photoUrl: '/assets/doctors/dr-kumud-limbu.jpg',
    clinicalFocus: 'Joint pain, arthritis, bone and rheumatological consultation.',
    departmentId: 'orthopedics',
    opdFee: 400,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 1,
  },
  {
    id: 'dr-prem-bahadur-shahi',
    name: 'Dr. Prem Bahadur Shahi',
    specialty: 'Senior Orthopedic, Neuro & Spine Surgeon (प्रमुख विशेषज्ञ हाडजोर्नी नशा तथा मेरुदण्ड सर्जन)',
    qualification:
      'MS - Orthopedics (B&B Hospital/HRDC); Fellowship in Spine Surgery (GRIPMER, India); Microscopic & Neuro-Endoscopic Spine Surgery (SGRH, India); Navigation Spine Surgery Training (Singapore)',
    nmcNo: '6802',
    opdSchedule: 'Daily Service (दैनिक सेवा)',
    photoUrl: '/assets/doctors/dr-prem-bahadur-shahi.jpg',
    clinicalFocus: 'Microscopic & neuro-endoscopic spine surgery, orthopedic trauma, and nerve compression care.',
    departmentId: 'orthopedics',
    opdFee: 400,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 2,
  },
  {
    id: 'dr-keshar-bahadur-gurung',
    name: 'Dr. Keshar Bahadur Gurung',
    specialty: 'Consultant Physician',
    qualification: 'MBBS, MD',
    nmcNo: '',
    opdSchedule: '',
    photoUrl: '/assets/doctors/dr-keshar-bahadur-gurung.jpg',
    clinicalFocus: 'Internal medicine consultation for stomach, chest, heart, diabetes, and general medical conditions.',
    departmentId: 'medicine-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 3,
  },
  {
    id: 'dr-sachin-silapkar',
    name: 'Dr. Sachin Lal Silpakar',
    specialty: 'Senior ENT Specialist (वरिष्ठ नाक, कान र घाँटी रोग विशेषज्ञ)',
    qualification: '',
    nmcNo: '4837',
    opdSchedule: 'Daily Service (दैनिक सेवा)',
    photoUrl: '/assets/doctors/dr-sachin-silpakar.jpg',
    clinicalFocus:
      'Ear infections & hearing issues, sinusitis & deviated nasal septum, throat polyps & tonsils, thyroid/head & neck tumors, throat endoscopy.',
    departmentId: 'surgery-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 4,
  },
  {
    id: 'dr-laxam-rana-magar',
    name: 'Dr. Laxman Rana Magar',
    specialty: 'General and Laparoscopic Surgeon (वरिष्ठ जनरल एण्ड ल्याप्रोस्कोपीक सर्जन)',
    qualification: 'MBBS, MS',
    nmcNo: '',
    opdSchedule: 'Daily Service (दैनिक सेवा)',
    photoUrl: '/assets/doctors/dr-laxman-rana-magar.jpg',
    clinicalFocus:
      'Gallbladder stones & polyps, intestinal & urinary ulcers, appendicitis, body lumps/cysts, and laparoscopic surgical care.',
    departmentId: 'surgery-ward',
    opdFee: 500,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 5,
  },
  {
    id: 'dr-dharmapal-ray',
    name: 'Dr. Dharmapal Ray',
    specialty: 'Neonatal, Pediatric & Child Nutrition Specialist (नवजात शिशु, बालरोग तथा बालपोषण विशेषज्ञ)',
    qualification:
      'MBBS, MD (Pediatrics) (K.U.); PGPN, Boston University (USA); Training in Pediatric Asthma (IAP)',
    nmcNo: '5550',
    opdSchedule: 'Daily Service (दैनिक सेवा)',
    photoUrl: '/assets/doctors/dr-dharmapal-ray.jpg',
    clinicalFocus:
      'Complete child health checkup, newborn care, fever/cough/respiratory care, nutrition & growth counseling, dengue/typhoid/pneumonia care.',
    departmentId: 'neonatal-pediatrics',
    opdFee: 0,
    isAvailable: true,
    availableSlots: [...DEFAULT_OPD_SLOTS],
    sortOrder: 6,
  },
];

export const OFFICIAL_OTHER_SERVICES = {
  diagnosticsAndSupport: [
    {
      index: '06',
      title: 'Physiotherapy',
      nepali: 'फिजियोथेरापी',
      detail: 'Structured physical rehabilitation, post-trauma mobility recovery, and pain therapy.',
    },
    {
      index: '07',
      title: 'X-ray and Video X-ray Services',
      nepali: 'एक्स-रे, भिडियो एक्स-रे सेवा',
      detail: 'Diagnostic digital radiography and ultrasound (video X-ray) imaging support.',
    },
    {
      index: '08',
      title: 'Advanced Laboratory Services',
      nepali: 'अत्याधुनिक ल्याब सेवा',
      detail: 'Comprehensive clinical pathology, hematology, and biochemistry diagnostic testing.',
    },
    {
      index: '09',
      title: '24-Hour Pharmacy Services',
      nepali: '२४ घण्टा फार्मेसी सेवा',
      detail: 'Round-the-clock in-house dispensing of prescribed medications and surgical supplies.',
    },
  ],
  criticalCareAndWards: [
    { index: '10', title: 'ICU Services', detail: 'Intensive Care Unit for continuous adult critical monitoring.' },
    { index: '11', title: 'NICU Services', detail: 'Neonatal Intensive Care Unit for specialized newborn support.' },
    { index: '12', title: 'PICU Services', detail: 'Pediatric Intensive Care Unit for critically ill children.' },
    { index: '13', title: 'Day Care Surgical Ward', detail: 'Same-day minor surgical observation and recovery ward.' },
    { index: '14', title: 'Nursery', detail: 'Supervised newborn nursery care and neonatal observation.' },
    { index: '15', title: 'Post-operative Ward', detail: 'Close nursing surveillance following surgical procedures.' },
    { index: '16', title: 'Trauma Ward', detail: 'Dedicated inpatient unit for acute fracture and injury stabilization.' },
    { index: '17', title: 'Medical Ward', detail: 'Inpatient internal medicine admission and physician rounds.' },
    { index: '18', title: 'Cabin Facilities', detail: 'Private inpatient rooms for comfortable recovery and family stay.' },
  ],
  emergencyAndOpd: [
    {
      index: '19',
      title: '24-Hour Emergency and Trauma Services',
      detail: 'Round-the-clock emergency triage, trauma response, and urgent stabilization.',
    },
    {
      index: '20',
      title: 'Daily OPD Services',
      detail: 'Structured daily outpatient specialist consultations with online slot booking.',
    },
  ],
} as const;

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
    question: 'Can I set an appointment reminder after booking?',
    answer:
      'Yes. During booking you can select your reminder timing preference, download a Calendar Reminder (.ics) file with automatic alerts, enable browser reminder alerts, or view upcoming appointment reminders in the Check Status page.',
  },
  {
    question: 'Can two patients book the same doctor and time slot?',
    answer:
      'No. Each doctor, date, and time slot is locked atomically in our database upon booking. Booked slots appear unavailable immediately to prevent double-booking.',
  },
  {
    question: 'Is emergency and trauma care available at night and on holidays?',
    answer:
      'Yes. Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd. operates 24-Hour Emergency and Trauma Services, ICU, NICU, PICU, and 24-Hour Pharmacy Services at Bhagwan Chowk, Birtamode-3, Jhapa. For urgent assistance, call 9807923351 or 023-591068.',
  },
  {
    question: 'How is my patient information protected?',
    answer:
      'Patient appointment details, mobile numbers, and visit notes are strictly restricted to authorized hospital administrators. Public visitors cannot browse or view other patients’ records.',
  },
];
