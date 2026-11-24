import {
  AlertCircle,
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { lookupAppointmentStatus } from '../services/hospitalService';
import type { AppointmentStatusRecord, AppointmentStatusValue } from '../types/hospital';
import {
  downloadCalendarReminder,
  getLocalAppointmentReminders,
  REMINDER_TIMING_LABELS,
  removeLocalAppointmentReminder,
  requestBrowserReminderNotification,
  type SavedLocalReminder,
} from '../utils/reminderUtils';

interface StatusLookupSectionProps {
  initialBookingId?: string;
  initialMobile?: string;
}

const STATUS_DISPLAY: Record<
  AppointmentStatusValue,
  { label: string; style: string; icon: typeof Clock3 }
> = {
  pending: {
    label: 'Pending Hospital Confirmation',
    style: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: Clock3,
  },
  approved: {
    label: 'Approved & Confirmed',
    style: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    icon: CheckCircle2,
  },
  completed: {
    label: 'Consultation Completed',
    style: 'bg-sky-50 text-[#0F4C81] border-sky-200',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected / Reschedule Required',
    style: 'bg-rose-50 text-rose-900 border-rose-200',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    style: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: XCircle,
  },
};

export function StatusLookupSection({
  initialBookingId = '',
  initialMobile = '',
}: StatusLookupSectionProps) {
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [mobileNumber, setMobileNumber] = useState(initialMobile);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AppointmentStatusRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [savedReminders, setSavedReminders] = useState<SavedLocalReminder[]>([]);
  const [alertStatusMsg, setAlertStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setSavedReminders(getLocalAppointmentReminders());
  }, [result]);

  useEffect(() => {
    if (initialBookingId) setBookingId(initialBookingId);
    if (initialMobile) setMobileNumber(initialMobile);
  }, [initialBookingId, initialMobile]);

  const runLookup = async (idToLookup: string, mobileToLookup: string) => {
    setErrorMsg(null);
    setSearched(false);
    setAlertStatusMsg(null);
    setLoading(true);
    try {
      const record = await lookupAppointmentStatus(idToLookup, mobileToLookup);
      setResult(record);
      setSearched(true);
    } catch (err) {
      setResult(null);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to check appointment status.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLookup(bookingId, mobileNumber);
  };

  const statusMeta = result ? STATUS_DISPLAY[result.status] : null;
  const StatusIcon = statusMeta?.icon || Clock3;

  return (
    <section className="py-16 lg:py-22 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-[920px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="space-y-2.5 text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold text-emerald-800">
            Verified Patient Lookup &amp; Reminders
          </p>
          <h2
            className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            Check Appointment Status &amp; Reminders
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Enter both your unique Booking ID and the mobile number used during registration. Other
            patients’ records remain strictly private.
          </p>
        </div>

        {/* Upcoming Saved Local Appointment Reminders */}
        {savedReminders.length > 0 && (
          <div className="surface-card rounded-2xl border-sky-200 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0F4C81]">
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Your Upcoming Saved Appointment Reminders ({savedReminders.length})</span>
            </div>
            <div className="divide-y divide-slate-100">
              {savedReminders.map((rem) => (
                <div
                  key={rem.bookingId}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div>
                    <span className="font-mono font-bold text-[#0F4C81] mr-2">
                      {rem.bookingId}
                    </span>
                    <span className="font-semibold text-slate-900">{rem.doctorName}</span>
                    <span className="text-slate-600">
                      {' '}
                      · {rem.appointmentDate} at {rem.timeSlot}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBookingId(rem.bookingId);
                        setMobileNumber(rem.mobileNumber);
                        void runLookup(rem.bookingId, rem.mobileNumber);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50/70 text-xs font-semibold text-[#0F4C81] hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      Check Live Status
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCalendarReminder({
                          bookingId: rem.bookingId,
                          doctorName: rem.doctorName,
                          departmentName: rem.departmentName,
                          appointmentDate: rem.appointmentDate,
                          timeSlot: rem.timeSlot,
                          reminderTiming: rem.reminderTiming,
                        })
                      }
                      aria-label={`Download calendar reminder for ${rem.bookingId}`}
                      className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <CalendarPlus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeLocalAppointmentReminder(rem.bookingId);
                        setSavedReminders(getLocalAppointmentReminders());
                      }}
                      aria-label={`Remove saved reminder ${rem.bookingId}`}
                      className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleCheck}
          className="surface-card rounded-2xl p-6 sm:p-8 space-y-5"
        >
          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-700" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="status-booking-id"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Booking ID
              </label>
              <input
                id="status-booking-id"
                type="text"
                required
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value.toUpperCase())}
                placeholder="SXH-2026-XXXXXX"
                className="clinical-input px-3.5 py-2.5 text-sm font-mono uppercase"
              />
            </div>

            <div>
              <label
                htmlFor="status-mobile"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Registered Mobile Number
              </label>
              <input
                id="status-mobile"
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="e.g. 98XXXXXXXX"
                className="clinical-input px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] disabled:bg-slate-300 transition-colors cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{loading ? 'Verifying...' : 'Verify & Check Status'}</span>
          </button>

          {searched && !result && (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
              No matching appointment was found for that Booking ID and mobile number combination.
              Please verify both fields carefully.
            </div>
          )}

          {result && statusMeta && (
            <div className="pt-5 border-t border-slate-200 space-y-5">
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${statusMeta.style}`}>
                <StatusIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-xs opacity-80">Current Appointment Status</div>
                  <div className="font-display font-bold text-base">{statusMeta.label}</div>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Booking ID</dt>
                  <dd className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                    {result.bookingId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Patient Initials</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{result.patientInitials}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Department</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{result.departmentName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Doctor</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{result.doctorName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Scheduled Date &amp; Slot</dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                    {result.appointmentDate} · {result.timeSlot}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">OPD Fee</dt>
                  <dd className="font-mono tabular-nums font-bold text-[#0F4C81] mt-0.5">
                    {result.opdFee > 0 ? `NPR ${result.opdFee}` : 'Confirm at OPD Desk'}
                  </dd>
                </div>
                {result.reminderTiming && result.reminderTiming !== 'none' && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Appointment Reminder Preference</dt>
                    <dd className="text-xs font-medium text-slate-800 mt-1">
                      {REMINDER_TIMING_LABELS[result.reminderTiming]} ·{' '}
                      {result.reminderChannel || 'Calendar & Browser Alert'} ·{' '}
                      <span className="capitalize font-semibold text-emerald-800">
                        {result.reminderStatus === 'sent' ? 'Reminder Sent' : 'Scheduled'}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>

              {result.adminNote && (
                <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-sm">
                  <div className="text-xs font-semibold text-[#0F4C81] mb-1">
                    Hospital Desk Note
                  </div>
                  <p className="text-slate-800">{result.adminNote}</p>
                </div>
              )}

              {(result.status === 'pending' || result.status === 'approved') && (
                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadCalendarReminder({
                        bookingId: result.bookingId,
                        doctorName: result.doctorName,
                        departmentName: result.departmentName,
                        appointmentDate: result.appointmentDate,
                        timeSlot: result.timeSlot,
                        reminderTiming: result.reminderTiming || '24_hours_before',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sky-300 bg-sky-50 text-xs font-semibold text-[#0F4C81] hover:bg-sky-100 cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add Calendar Reminder (.ics)</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const status = await requestBrowserReminderNotification({
                        bookingId: result.bookingId,
                        doctorName: result.doctorName,
                        appointmentDate: result.appointmentDate,
                        timeSlot: result.timeSlot,
                      });
                      setAlertStatusMsg(
                        status === 'granted'
                          ? 'Browser alert enabled for this visit.'
                          : 'Use the Calendar (.ics) download to set a reminder on your phone or computer.'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Browser Notification</span>
                  </button>
                  {alertStatusMsg && (
                    <span className="text-xs text-slate-600">{alertStatusMsg}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
