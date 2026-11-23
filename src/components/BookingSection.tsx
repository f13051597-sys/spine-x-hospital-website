import {
  AlertCircle,
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Printer,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_OPD_SLOTS, HOSPITAL_INFO } from '../data/hospitalCatalog';
import {
  createAppointmentBooking,
  fetchBookedSlotsForDoctorDate,
  type BookingConfirmation,
} from '../services/hospitalService';
import type {
  Department,
  Doctor,
  GenderOption,
  ReminderChannel,
  ReminderTiming,
} from '../types/hospital';
import {
  buildWhatsAppReminderHref,
  downloadCalendarReminder,
  REMINDER_TIMING_LABELS,
  requestBrowserReminderNotification,
  saveLocalAppointmentReminder,
} from '../utils/reminderUtils';

interface BookingSectionProps {
  departments: Department[];
  doctors: Doctor[];
  preselectedDoctorId?: string;
  preselectedDepartmentId?: string;
  onGoToStatusCheck: (bookingId: string, mobileNumber: string) => void;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BookingSection({
  departments,
  doctors,
  preselectedDoctorId,
  preselectedDepartmentId,
  onGoToStatusCheck,
}: BookingSectionProps) {
  const availableDoctors = useMemo(
    () => doctors.filter((d) => d.isAvailable),
    [doctors]
  );

  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderOption>('');
  const [departmentId, setDepartmentId] = useState<string>(
    preselectedDepartmentId || departments[0]?.id || 'orthopedics'
  );
  const [doctorId, setDoctorId] = useState<string>(
    preselectedDoctorId || availableDoctors[0]?.id || ''
  );
  const [appointmentDate, setAppointmentDate] = useState<string>(getTodayDateString());
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [reason, setReason] = useState('');
  const [reminderTiming, setReminderTiming] = useState<ReminderTiming>('24_hours_before');
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>(
    'Calendar & Browser Alert'
  );

  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedDepartmentId && departments.some((d) => d.id === preselectedDepartmentId)) {
      setDepartmentId(preselectedDepartmentId);
      const matchingDoctor = availableDoctors.find(
        (doc) => doc.departmentId === preselectedDepartmentId
      );
      if (matchingDoctor && !preselectedDoctorId) {
        setDoctorId(matchingDoctor.id);
      }
    }
  }, [preselectedDepartmentId, departments, availableDoctors, preselectedDoctorId]);

  useEffect(() => {
    if (preselectedDoctorId) {
      const targetDoc = availableDoctors.find((d) => d.id === preselectedDoctorId);
      if (targetDoc) {
        setDoctorId(targetDoc.id);
        setDepartmentId(targetDoc.departmentId);
      }
    }
  }, [preselectedDoctorId, availableDoctors]);

  const selectedDoctor = useMemo(
    () => availableDoctors.find((d) => d.id === doctorId) || availableDoctors[0] || null,
    [availableDoctors, doctorId]
  );

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId) || departments[0] || null,
    [departments, departmentId]
  );

  const doctorSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    return selectedDoctor.availableSlots.length > 0
      ? selectedDoctor.availableSlots
      : DEFAULT_OPD_SLOTS;
  }, [selectedDoctor]);

  useEffect(() => {
    let active = true;
    async function loadSlots() {
      if (!selectedDoctor || !appointmentDate) {
        setBookedSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const locks = await fetchBookedSlotsForDoctorDate(selectedDoctor.id, appointmentDate);
        if (!active) return;
        const taken = locks.map((l) => l.timeSlot);
        setBookedSlots(taken);
        setTimeSlot((prev) => (taken.includes(prev) ? '' : prev));
      } catch (err) {
        console.warn('Could not load slot locks:', err);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    void loadSlots();
    return () => {
      active = false;
    };
  }, [selectedDoctor, appointmentDate]);

  const handleDoctorChange = (nextDoctorId: string) => {
    setDoctorId(nextDoctorId);
    setTimeSlot('');
    const docObj = availableDoctors.find((d) => d.id === nextDoctorId);
    if (docObj && departments.some((dept) => dept.id === docObj.departmentId)) {
      setDepartmentId(docObj.departmentId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotifFeedback(null);

    if (!selectedDoctor || !selectedDepartment) {
      setErrorMsg('Please select both a department and an available doctor.');
      return;
    }
    if (!timeSlot) {
      setErrorMsg('Please choose an available appointment time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createAppointmentBooking({
        patientName,
        mobileNumber,
        age: Number(age),
        gender,
        department: selectedDepartment,
        doctor: selectedDoctor,
        appointmentDate,
        timeSlot,
        reason,
        reminderTiming,
        reminderChannel,
      });
      setConfirmation(result);
      setBookedSlots((prev) => [...prev, timeSlot]);
      if (reminderTiming !== 'none') {
        saveLocalAppointmentReminder({
          bookingId: result.bookingId,
          mobileNumber: result.mobileNumber,
          doctorName: result.doctorName,
          departmentName: result.departmentName,
          appointmentDate: result.appointmentDate,
          timeSlot: result.timeSlot,
          reminderTiming,
          createdAtIso: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to submit appointment. Please try again.';
      setErrorMsg(msg);
      if (selectedDoctor && appointmentDate) {
        try {
          const locks = await fetchBookedSlotsForDoctorDate(selectedDoctor.id, appointmentDate);
          setBookedSlots(locks.map((l) => l.timeSlot));
        } catch {
          // ignore refresh failure
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyBookingId = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.bookingId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard blocked in iframe
    }
  };

  const handleEnableBrowserReminder = async () => {
    if (!confirmation) return;
    const perm = await requestBrowserReminderNotification({
      bookingId: confirmation.bookingId,
      doctorName: confirmation.doctorName,
      appointmentDate: confirmation.appointmentDate,
      timeSlot: confirmation.timeSlot,
    });
    if (perm === 'granted') {
      setNotifFeedback('Browser notification reminder enabled for this device.');
    } else if (perm === 'denied') {
      setNotifFeedback('Browser notifications are blocked; download the Calendar (.ics) reminder instead.');
    } else {
      setNotifFeedback('Browser notifications are not supported here; use the Calendar (.ics) download.');
    }
  };

  const handleReset = () => {
    setConfirmation(null);
    setPatientName('');
    setMobileNumber('');
    setAge('');
    setGender('');
    setTimeSlot('');
    setReason('');
    setErrorMsg(null);
    setNotifFeedback(null);
  };

  return (
    <section className="py-14 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Context & Instructions */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-800">Online OPD Registration</p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
                style={{ textWrap: 'balance' }}
              >
                Book Your Hospital Appointment
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Reserve a confirmed time slot with our specialists. Each booked slot is locked
                immediately to prevent duplicate appointments.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                OPD Booking Summary
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Hospital</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {HOSPITAL_INFO.shortName}, Birtamode
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Department</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {selectedDepartment?.name || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Consultant</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {selectedDoctor?.name || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-200">
                  <dt className="text-slate-700 font-medium">OPD Consultation Fee</dt>
                  <dd className="font-mono tabular-nums text-base font-bold text-[#0F4C81]">
                    {selectedDoctor
                      ? selectedDoctor.opdFee > 0
                        ? `NPR ${selectedDoctor.opdFee}`
                        : 'Confirm at OPD Desk'
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2 text-sm">
              <p className="font-semibold text-emerald-950">Need Urgent Trauma or Emergency Care?</p>
              <p className="text-emerald-900">
                Do not wait for an OPD slot in an emergency. Call our 24/7 Emergency Desk directly
                at{' '}
                <a href={HOSPITAL_INFO.phoneHref} className="font-mono font-bold underline">
                  {HOSPITAL_INFO.phone}
                </a>{' '}
                or <span className="font-mono">{HOSPITAL_INFO.landlines}</span>.
              </p>
            </div>
          </div>

          {/* Right Form or Confirmation Card */}
          <div className="lg:col-span-7">
            {confirmation ? (
              <div className="bg-white border border-emerald-300 rounded-xl p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="w-7 h-7 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-emerald-800">
                      Appointment Request Recorded
                    </p>
                    <h3 className="font-display text-2xl font-bold text-slate-950">
                      Booking Confirmed — Pending Desk Review
                    </h3>
                  </div>
                </div>

                <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Unique Booking ID</div>
                    <div className="font-mono tabular-nums text-xl font-bold text-[#0F4C81] mt-0.5">
                      {confirmation.bookingId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyBookingId}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
                  <div>
                    <dt className="text-xs text-slate-500">Patient Name</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">{confirmation.patientName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Verified Mobile Number</dt>
                    <dd className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                      {confirmation.mobileNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Department</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {confirmation.departmentName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Doctor</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">{confirmation.doctorName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Date &amp; Time Slot</dt>
                    <dd className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                      {confirmation.appointmentDate} · {confirmation.timeSlot}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">OPD Fee (Pay at Hospital)</dt>
                    <dd className="font-mono tabular-nums font-semibold text-[#0F4C81] mt-0.5">
                      {confirmation.opdFee > 0
                        ? `NPR ${confirmation.opdFee}`
                        : 'Confirm at OPD Desk'}
                    </dd>
                  </div>
                </dl>

                {/* Appointment Reminder Controls */}
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0F4C81]">
                    <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      Appointment Reminder ({REMINDER_TIMING_LABELS[confirmation.reminderTiming]})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCalendarReminder({
                          bookingId: confirmation.bookingId,
                          doctorName: confirmation.doctorName,
                          departmentName: confirmation.departmentName,
                          appointmentDate: confirmation.appointmentDate,
                          timeSlot: confirmation.timeSlot,
                          reminderTiming: confirmation.reminderTiming,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-sky-300 text-xs font-medium text-[#0F4C81] hover:bg-sky-100 cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Calendar Reminder (.ics)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnableBrowserReminder}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Enable Browser Alert</span>
                    </button>

                    <a
                      href={buildWhatsAppReminderHref({
                        bookingId: confirmation.bookingId,
                        doctorName: confirmation.doctorName,
                        appointmentDate: confirmation.appointmentDate,
                        timeSlot: confirmation.timeSlot,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>WhatsApp Reminder</span>
                    </a>
                  </div>
                  {notifFeedback && (
                    <p className="text-xs text-slate-700">{notifFeedback}</p>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pt-3 border-t border-slate-200">
                  Save your Booking ID and mobile number to check approval updates anytime.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onGoToStatusCheck(confirmation.bookingId, confirmation.mobileNumber)
                    }
                    className="px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                  >
                    Check Appointment Status
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Book Another Appointment
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
              >
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-700" aria-hidden="true" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="booking-patient-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Patient Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="booking-patient-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter patient's full name"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-mobile"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="booking-mobile"
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 98XXXXXXXX"
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="booking-age"
                        className="block text-sm font-medium text-slate-800 mb-1.5"
                      >
                        Age <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="booking-age"
                        type="number"
                        required
                        min={0}
                        max={120}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Years"
                        className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="booking-gender"
                        className="block text-sm font-medium text-slate-800 mb-1.5"
                      >
                        Gender
                      </label>
                      <select
                        id="booking-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value as GenderOption)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                      >
                        <option value="">Optional</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-department"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Select Department <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="booking-department"
                      required
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-doctor"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Select Doctor <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id="booking-doctor"
                      required
                      value={selectedDoctor?.id || ''}
                      onChange={(e) => handleDoctorChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    >
                      {availableDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name}
                          {doc.opdFee > 0 ? ` — NPR ${doc.opdFee}` : ' — OPD'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="booking-date"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Appointment Date <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      required
                      min={getTodayDateString()}
                      value={appointmentDate}
                      onChange={(e) => {
                        setAppointmentDate(e.target.value);
                        setTimeSlot('');
                      }}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>
                </div>

                {/* Time Slot Grid */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-sm font-medium text-slate-800">
                      Select Available Time Slot <span className="text-rose-600">*</span>
                    </span>
                    {loadingSlots && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Checking live availability...
                      </span>
                    )}
                  </div>

                  {doctorSlots.length === 0 ? (
                    <p className="text-sm text-slate-600 p-4 rounded-lg bg-slate-50 border border-slate-200">
                      No online slots are currently configured for this doctor. Please call{' '}
                      {HOSPITAL_INFO.phone} to schedule.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {doctorSlots.map((slot) => {
                        const isBooked = bookedSlots.includes(slot);
                        const isSelected = timeSlot === slot && !isBooked;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isBooked || loadingSlots}
                            onClick={() => setTimeSlot(slot)}
                            className={`px-3 py-2.5 rounded-lg border text-xs font-mono tabular-nums font-medium transition-colors flex flex-col items-center justify-center gap-0.5 ${
                              isBooked
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                                : isSelected
                                  ? 'bg-[#0F4C81] border-[#0F4C81] text-white cursor-pointer'
                                  : 'bg-white border-slate-300 text-slate-800 hover:border-[#0F4C81] hover:bg-sky-50 cursor-pointer'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {slot}
                            </span>
                            {isBooked && (
                              <span className="text-[10px] font-sans no-underline text-slate-500">
                                Booked
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Appointment Reminder Options */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="booking-reminder-timing"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      Appointment Reminder Timing
                    </label>
                    <select
                      id="booking-reminder-timing"
                      value={reminderTiming}
                      onChange={(e) => setReminderTiming(e.target.value as ReminderTiming)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    >
                      <option value="24_hours_before">24 hours before visit</option>
                      <option value="2_hours_before">2 hours before visit</option>
                      <option value="morning_of_visit">Morning of visit (07:30 AM)</option>
                      <option value="none">No reminder needed</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-reminder-channel"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      Preferred Reminder Method
                    </label>
                    <select
                      id="booking-reminder-channel"
                      disabled={reminderTiming === 'none'}
                      value={reminderTiming === 'none' ? 'None' : reminderChannel}
                      onChange={(e) => setReminderChannel(e.target.value as ReminderChannel)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-100 focus:outline-none focus:border-[#0F4C81]"
                    >
                      <option value="Calendar & Browser Alert">Calendar &amp; Browser Alert</option>
                      <option value="WhatsApp Desk Reminder">WhatsApp Desk Reminder</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-reason"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Reason for Visit (Optional)
                  </label>
                  <textarea
                    id="booking-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe symptoms or consultation purpose..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedDoctor || availableDoctors.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0B3A63] disabled:bg-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{submitting ? 'Confirming Slot...' : 'Submit Appointment'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
