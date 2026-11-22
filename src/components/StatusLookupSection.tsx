import { AlertCircle, CheckCircle2, Clock3, Loader2, Search, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { lookupAppointmentStatus } from '../services/hospitalService';
import type { AppointmentStatusRecord, AppointmentStatusValue } from '../types/hospital';

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

  useEffect(() => {
    if (initialBookingId) setBookingId(initialBookingId);
    if (initialMobile) setMobileNumber(initialMobile);
  }, [initialBookingId, initialMobile]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSearched(false);
    setLoading(true);
    try {
      const record = await lookupAppointmentStatus(bookingId, mobileNumber);
      setResult(record);
      setSearched(true);
    } catch (err) {
      setResult(null);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to check appointment status.');
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = result ? STATUS_DISPLAY[result.status] : null;
  const StatusIcon = statusMeta?.icon || Clock3;

  return (
    <section className="py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <p className="text-xs font-medium text-emerald-800">Verified Patient Lookup</p>
          <h2
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            Check Appointment Status
          </h2>
          <p className="text-sm text-slate-600">
            Enter both your unique Booking ID and the mobile number used during registration. Other
            patients’ records remain strictly private.
          </p>
        </div>

        <form
          onSubmit={handleCheck}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="status-booking-id"
                className="block text-sm font-medium text-slate-800 mb-1.5"
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
                className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label
                htmlFor="status-mobile"
                className="block text-sm font-medium text-slate-800 mb-1.5"
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
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-300 transition-colors cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{loading ? 'Verifying...' : 'Verify & Check Status'}</span>
          </button>

          {searched && !result && (
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
              No matching appointment was found for that Booking ID and mobile number combination.
              Please verify both fields carefully.
            </div>
          )}

          {result && statusMeta && (
            <div className="pt-4 border-t border-slate-200 space-y-5">
              <div className={`p-4 rounded-lg border flex items-center gap-3 ${statusMeta.style}`}>
                <StatusIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-xs opacity-80">Current Appointment Status</div>
                  <div className="font-display font-semibold text-base">{statusMeta.label}</div>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Booking ID</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {result.bookingId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Patient Initials</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{result.patientInitials}</dd>
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
                  <dd className="font-mono tabular-nums font-semibold text-[#0F4C81] mt-0.5">
                    NPR {result.opdFee}
                  </dd>
                </div>
              </dl>

              {result.adminNote && (
                <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 text-sm">
                  <div className="text-xs font-medium text-[#0F4C81] mb-1">
                    Hospital Desk Note
                  </div>
                  <p className="text-slate-800">{result.adminNote}</p>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
