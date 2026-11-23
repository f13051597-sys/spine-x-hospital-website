import { HOSPITAL_INFO } from '../data/hospitalCatalog';
import type { ReminderTiming } from '../types/hospital';

export interface SavedLocalReminder {
  bookingId: string;
  mobileNumber: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  reminderTiming: ReminderTiming;
  createdAtIso: string;
}

const LOCAL_REMINDERS_KEY = 'spinex_patient_reminders_v1';

export const REMINDER_TIMING_LABELS: Record<ReminderTiming, string> = {
  '24_hours_before': '24 hours before appointment',
  '2_hours_before': '2 hours before appointment',
  morning_of_visit: 'Morning of visit (07:30 AM)',
  none: 'No reminder needed',
};

export function parseSlotToHoursMinutes(timeSlot: string): { hours: number; minutes: number } {
  const match = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

export function buildAppointmentDateObject(appointmentDate: string, timeSlot: string): Date | null {
  const parts = appointmentDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const { hours, minutes } = parseSlotToHoursMinutes(timeSlot);
  return new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, 0, 0);
}

function formatIcsLocalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function formatIcsUtcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export function downloadCalendarReminder(params: {
  bookingId: string;
  doctorName: string;
  departmentName: string;
  appointmentDate: string;
  timeSlot: string;
  reminderTiming?: ReminderTiming;
}): void {
  const start = buildAppointmentDateObject(params.appointmentDate, params.timeSlot);
  if (!start) return;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const trigger =
    params.reminderTiming === '2_hours_before'
      ? '-PT2H'
      : params.reminderTiming === 'morning_of_visit'
        ? '-PT1H30M'
        : '-PT24H';

  const uid = `${params.bookingId}@spinexhospital.com.np`;
  const summary = `OPD Appointment: ${params.doctorName} (${HOSPITAL_INFO.shortName})`;
  const description = [
    `Booking ID: ${params.bookingId}`,
    `Department: ${params.departmentName}`,
    `Consultant: ${params.doctorName}`,
    `Slot: ${params.appointmentDate} at ${params.timeSlot}`,
    `Hospital: ${HOSPITAL_INFO.name}`,
    `Address: ${HOSPITAL_INFO.address}`,
    `Desk Phone: ${HOSPITAL_INFO.phone}`,
  ].join('\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spine X Hospital//OPD Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtcStamp(new Date())}`,
    `DTSTART:${formatIcsLocalDateTime(start)}`,
    `DTEND:${formatIcsLocalDateTime(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${HOSPITAL_INFO.name}, ${HOSPITAL_INFO.address}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: OPD Visit with ${params.doctorName} at ${params.timeSlot}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${params.bookingId}-reminder.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function saveLocalAppointmentReminder(item: SavedLocalReminder): void {
  try {
    const existing = getLocalAppointmentReminders().filter(
      (r) => r.bookingId !== item.bookingId
    );
    const updated = [item, ...existing].slice(0, 10);
    window.localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

export function getLocalAppointmentReminders(): SavedLocalReminder[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    return parsed.filter(
      (item): item is SavedLocalReminder =>
        Boolean(item) &&
        typeof item.bookingId === 'string' &&
        typeof item.appointmentDate === 'string' &&
        item.appointmentDate >= todayStr
    );
  } catch {
    return [];
  }
}

export function removeLocalAppointmentReminder(bookingId: string): void {
  try {
    const updated = getLocalAppointmentReminders().filter((r) => r.bookingId !== bookingId);
    window.localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export async function requestBrowserReminderNotification(params: {
  bookingId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
}): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification(`Appointment Reminder Saved (${params.bookingId})`, {
      body: `${params.doctorName} on ${params.appointmentDate} at ${params.timeSlot} — ${HOSPITAL_INFO.shortName}, Birtamode.`,
    });
    return 'granted';
  }
  return 'denied';
}

export function buildWhatsAppReminderHref(params: {
  mobileNumber?: string;
  patientName?: string;
  bookingId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  forPatient?: boolean;
}): string {
  const cleanDigits = (params.mobileNumber || HOSPITAL_INFO.phone).replace(/\D/g, '');
  const phone = cleanDigits.startsWith('977') ? cleanDigits : `977${cleanDigits}`;
  const text = params.forPatient
    ? `Namaste ${params.patientName || ''}, this is an appointment reminder from ${HOSPITAL_INFO.name}. Your OPD visit (${params.bookingId}) with ${params.doctorName} is scheduled on ${params.appointmentDate} at ${params.timeSlot}. Address: ${HOSPITAL_INFO.address}. For help call ${HOSPITAL_INFO.phone}.`
    : `Namaste Spine X Hospital Desk, I would like a WhatsApp reminder for my OPD appointment ${params.bookingId} with ${params.doctorName} on ${params.appointmentDate} at ${params.timeSlot}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
