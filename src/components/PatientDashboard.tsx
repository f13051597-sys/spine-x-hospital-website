import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  LogOut,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';
import { auth, googleProvider } from '../lib/firebase';
import {
  createRefundRequest,
  fetchSignedInPatientRecords,
  lookupPatientBundleByRef,
  validateRefundEligibility,
} from '../services/hospitalService';
import type {
  Appointment,
  AppointmentStatusRecord,
  PaymentPortalRecord,
  PaymentRecord,
  RefundEligibilityType,
  RefundPortalRecord,
  RefundRequest,
  RefundStatus,
} from '../types/hospital';
import {
  buildPaymentWhatsAppHref,
  buildRefundWhatsAppHref,
  getLocalPatientRecordRefs,
  removeLocalPatientRecordRef,
  saveLocalPatientRecordRef,
} from '../utils/paymentUtils';

interface PatientDashboardProps {
  onNavigateToPay: () => void;
  onNavigateToBook: () => void;
}

type DashboardTab = 'appointments' | 'payments' | 'refunds';

interface UnifiedAppointmentRow {
  key: string;
  bookingId: string;
  appointmentId: string;
  patientDisplay: string;
  mobileNumber: string;
  departmentName: string;
  doctorName: string;
  opdFee: number;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  adminNote: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  paymentRef?: string;
  transactionId?: string;
}

interface UnifiedPaymentRow {
  key: string;
  paymentId: string;
  paymentRef: string;
  paymentCategory: 'general' | 'appointment';
  patientDisplay: string;
  mobileNumber: string;
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
  verificationStatus: 'pending_verification' | 'verified' | 'rejected';
  rejectionReason: string;
  createdAtText: string;
}

interface UnifiedRefundRow {
  key: string;
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
  createdAtText: string;
}

const VERIFICATION_BADGE: Record<string, string> = {
  pending_verification: 'bg-amber-50 text-amber-900 border-amber-200',
  verified: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-900 border-rose-200',
};

const VERIFICATION_LABEL: Record<string, string> = {
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  rejected: 'Rejected',
};

const REFUND_BADGE: Record<RefundStatus, string> = {
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
  approved: 'bg-sky-50 text-[#0F4C81] border-sky-200',
  rejected: 'bg-rose-50 text-rose-900 border-rose-200',
  refunded: 'bg-emerald-50 text-emerald-900 border-emerald-200',
};

const APPT_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  completed: 'bg-sky-50 text-[#0F4C81] border-sky-200',
  rejected: 'bg-rose-50 text-rose-900 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function PatientDashboard({
  onNavigateToPay,
  onNavigateToBook,
}: PatientDashboardProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [activeTab, setActiveTab] = useState<DashboardTab>('appointments');

  // Verified lookup form state
  const [lookupRefId, setLookupRefId] = useState('');
  const [lookupMobile, setLookupMobile] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Records from Google Sign-In
  const [signedAppointments, setSignedAppointments] = useState<Appointment[]>([]);
  const [signedPayments, setSignedPayments] = useState<PaymentRecord[]>([]);
  const [signedRefunds, setSignedRefunds] = useState<RefundRequest[]>([]);

  // Records from SHA-256 Verified Reference + Mobile lookups
  const [portalAppts, setPortalAppts] = useState<
    Array<{ record: AppointmentStatusRecord; mobile: string }>
  >([]);
  const [portalPayments, setPortalPayments] = useState<
    Array<{ record: PaymentPortalRecord; mobile: string }>
  >([]);
  const [portalRefunds, setPortalRefunds] = useState<
    Array<{ record: RefundPortalRecord; mobile: string }>
  >([]);

  // Transaction details modal
  const [selectedTx, setSelectedTx] = useState<UnifiedPaymentRow | null>(null);

  // Refund modal / drawer state
  const [refundTarget, setRefundTarget] = useState<UnifiedPaymentRow | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<{
    eligible: boolean;
    refundPercentage: number;
    eligibilityType: RefundEligibilityType | null;
    reason: string;
  } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
    });
  }, []);

  const mergePortalBundle = useCallback(
    (
      bundle: {
        appointmentStatus: AppointmentStatusRecord | null;
        paymentPortal: PaymentPortalRecord | null;
        refundPortal: RefundPortalRecord | null;
      },
      mobile: string
    ) => {
      if (bundle.appointmentStatus) {
        const appt = bundle.appointmentStatus;
        setPortalAppts((prev) => [
          { record: appt, mobile },
          ...prev.filter((p) => p.record.bookingId !== appt.bookingId),
        ]);
      }
      if (bundle.paymentPortal) {
        const pay = bundle.paymentPortal;
        setPortalPayments((prev) => [
          { record: pay, mobile },
          ...prev.filter((p) => p.record.paymentRef !== pay.paymentRef),
        ]);
      }
      if (bundle.refundPortal) {
        const ref = bundle.refundPortal;
        setPortalRefunds((prev) => [
          { record: ref, mobile },
          ...prev.filter((p) => p.record.refundRef !== ref.refundRef),
        ]);
      }
    },
    []
  );

  const hydrateSavedAndSignedIn = useCallback(async () => {
    setLoadingSaved(true);
    try {
      if (user) {
        const owned = await fetchSignedInPatientRecords(user.uid);
        setSignedAppointments(owned.appointments);
        setSignedPayments(owned.payments);
        setSignedRefunds(owned.refunds);
      } else {
        setSignedAppointments([]);
        setSignedPayments([]);
        setSignedRefunds([]);
      }

      const localRefs = getLocalPatientRecordRefs();
      for (const item of localRefs.slice(0, 12)) {
        try {
          const bundle = await lookupPatientBundleByRef(item.refId, item.mobileNumber);
          mergePortalBundle(bundle, item.mobileNumber);
        } catch {
          // Ignore stale or mismatched local refs
        }
      }
    } catch (err) {
      console.warn('Could not refresh patient dashboard:', err);
    } finally {
      setLoadingSaved(false);
    }
  }, [user, mergePortalBundle]);

  useEffect(() => {
    void hydrateSavedAndSignedIn();
  }, [hydrateSavedAndSignedIn]);

  const handleVerifiedLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLookupLoading(true);
    try {
      const cleanRef = lookupRefId.trim().toUpperCase();
      const bundle = await lookupPatientBundleByRef(cleanRef, lookupMobile);
      if (!bundle.appointmentStatus && !bundle.paymentPortal && !bundle.refundPortal) {
        setErrorMsg(
          'No matching appointment or payment found for that Reference ID and Mobile Number.'
        );
        return;
      }

      mergePortalBundle(bundle, lookupMobile.replace(/\D/g, ''));

      if (bundle.appointmentStatus) {
        saveLocalPatientRecordRef({
          refId: bundle.appointmentStatus.bookingId,
          kind: 'appointment',
          bookingId: bundle.appointmentStatus.bookingId,
          paymentRef: bundle.appointmentStatus.paymentRef,
          mobileNumber: lookupMobile.replace(/\D/g, ''),
          doctorName: bundle.appointmentStatus.doctorName,
          appointmentDate: bundle.appointmentStatus.appointmentDate,
          timeSlot: bundle.appointmentStatus.timeSlot,
          amount: bundle.appointmentStatus.opdFee,
          createdAtIso: new Date().toISOString(),
        });
      }
      if (bundle.paymentPortal) {
        saveLocalPatientRecordRef({
          refId: bundle.paymentPortal.paymentRef,
          kind: 'payment',
          paymentRef: bundle.paymentPortal.paymentRef,
          bookingId: bundle.paymentPortal.bookingId || undefined,
          mobileNumber: lookupMobile.replace(/\D/g, ''),
          doctorName: bundle.paymentPortal.doctorName || undefined,
          appointmentDate: bundle.paymentPortal.appointmentDate || undefined,
          timeSlot: bundle.paymentPortal.timeSlot || undefined,
          amount: bundle.paymentPortal.amount,
          createdAtIso: new Date().toISOString(),
        });
        setActiveTab('payments');
      }
      setSuccessMsg(`Verified and loaded records for ${cleanRef}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lookup verification failed.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Deduplicated unified lists combining signed-in owner records + verified portal lookups
  const unifiedAppointments = useMemo<UnifiedAppointmentRow[]>(() => {
    const map = new Map<string, UnifiedAppointmentRow>();
    for (const a of signedAppointments) {
      map.set(a.bookingId, {
        key: a.id,
        bookingId: a.bookingId,
        appointmentId: a.id,
        patientDisplay: a.patientName,
        mobileNumber: a.mobileNumber,
        departmentName: a.departmentName,
        doctorName: a.doctorName,
        opdFee: a.opdFee,
        appointmentDate: a.appointmentDate,
        timeSlot: a.timeSlot,
        status: a.status,
        adminNote: a.adminNote,
        paymentMethod: a.paymentMethod,
        paymentStatus: a.paymentStatus,
        paymentId: a.paymentId,
        paymentRef: a.paymentRef,
        transactionId: a.transactionId,
      });
    }
    for (const item of portalAppts) {
      const a = item.record;
      if (!map.has(a.bookingId)) {
        map.set(a.bookingId, {
          key: a.appointmentId,
          bookingId: a.bookingId,
          appointmentId: a.appointmentId,
          patientDisplay: a.patientInitials,
          mobileNumber: item.mobile,
          departmentName: a.departmentName,
          doctorName: a.doctorName,
          opdFee: a.opdFee,
          appointmentDate: a.appointmentDate,
          timeSlot: a.timeSlot,
          status: a.status,
          adminNote: a.adminNote,
          paymentMethod: a.paymentMethod,
          paymentStatus: a.paymentStatus,
          paymentId: a.paymentId,
          paymentRef: a.paymentRef,
          transactionId: a.transactionId,
        });
      }
    }
    return Array.from(map.values());
  }, [signedAppointments, portalAppts]);

  const unifiedPayments = useMemo<UnifiedPaymentRow[]>(() => {
    const map = new Map<string, UnifiedPaymentRow>();
    for (const p of signedPayments) {
      map.set(p.paymentRef, {
        key: p.id,
        paymentId: p.id,
        paymentRef: p.paymentRef,
        paymentCategory: p.paymentCategory,
        patientDisplay: p.patientName,
        mobileNumber: p.mobileNumber,
        amount: p.amount,
        transactionId: p.transactionId,
        purpose: p.purpose,
        bookingId: p.bookingId,
        appointmentId: p.appointmentId,
        doctorName: p.doctorName,
        departmentName: p.departmentName,
        appointmentDate: p.appointmentDate,
        timeSlot: p.timeSlot,
        screenshotDataUrl: p.screenshotDataUrl,
        screenshotUrl: p.screenshotUrl,
        verificationStatus: p.verificationStatus,
        rejectionReason: p.rejectionReason,
        createdAtText: p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : 'Recorded',
      });
    }
    for (const item of portalPayments) {
      const p = item.record;
      if (!map.has(p.paymentRef)) {
        map.set(p.paymentRef, {
          key: p.paymentId,
          paymentId: p.paymentId,
          paymentRef: p.paymentRef,
          paymentCategory: p.paymentCategory,
          patientDisplay: p.patientInitials,
          mobileNumber: item.mobile,
          amount: p.amount,
          transactionId: p.transactionId,
          purpose: p.purpose,
          bookingId: p.bookingId,
          appointmentId: p.appointmentId,
          doctorName: p.doctorName,
          departmentName: p.departmentName,
          appointmentDate: p.appointmentDate,
          timeSlot: p.timeSlot,
          screenshotDataUrl: p.screenshotDataUrl,
          screenshotUrl: p.screenshotUrl,
          verificationStatus: p.verificationStatus,
          rejectionReason: p.rejectionReason,
          createdAtText: p.createdAtIso
            ? new Date(p.createdAtIso).toLocaleString()
            : 'Recorded',
        });
      }
    }
    return Array.from(map.values());
  }, [signedPayments, portalPayments]);

  const unifiedRefunds = useMemo<UnifiedRefundRow[]>(() => {
    const map = new Map<string, UnifiedRefundRow>();
    for (const r of signedRefunds) {
      map.set(r.refundRef, {
        key: r.id,
        refundId: r.id,
        refundRef: r.refundRef,
        paymentId: r.paymentId,
        paymentRef: r.paymentRef,
        bookingId: r.bookingId,
        doctorName: r.doctorName,
        appointmentDate: r.appointmentDate,
        timeSlot: r.timeSlot,
        amount: r.amount,
        reason: r.reason,
        eligibilityType: r.eligibilityType,
        status: r.status,
        refundTxRef: r.refundTxRef,
        adminNote: r.adminNote,
        createdAtText: r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'Submitted',
      });
    }
    for (const item of portalRefunds) {
      const r = item.record;
      if (!map.has(r.refundRef)) {
        map.set(r.refundRef, {
          key: r.refundId,
          refundId: r.refundId,
          refundRef: r.refundRef,
          paymentId: r.paymentId,
          paymentRef: r.paymentRef,
          bookingId: r.bookingId,
          doctorName: r.doctorName,
          appointmentDate: r.appointmentDate,
          timeSlot: r.timeSlot,
          amount: r.amount,
          reason: r.reason,
          eligibilityType: r.eligibilityType,
          status: r.status,
          refundTxRef: r.refundTxRef,
          adminNote: r.adminNote,
          createdAtText: r.createdAtIso
            ? new Date(r.createdAtIso).toLocaleString()
            : 'Submitted',
        });
      }
    }
    return Array.from(map.values());
  }, [signedRefunds, portalRefunds]);

  const refundedPaymentIds = useMemo(
    () => new Set(unifiedRefunds.map((r) => r.paymentId)),
    [unifiedRefunds]
  );

  const openRefundChecker = async (payment: UnifiedPaymentRow) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setRefundTarget(payment);
    setRefundReason('');
    setEligibilityResult(null);
    setCheckingEligibility(true);

    const linkedAppt = unifiedAppointments.find(
      (a) => a.bookingId === payment.bookingId || a.appointmentId === payment.appointmentId
    );

    try {
      const res = await validateRefundEligibility({
        appointmentDate: payment.appointmentDate || linkedAppt?.appointmentDate || '',
        timeSlot: payment.timeSlot || linkedAppt?.timeSlot || '',
        appointmentStatus: linkedAppt?.status || 'pending',
        paymentVerificationStatus: payment.verificationStatus,
        amount: payment.amount,
      });
      setEligibilityResult(res);
    } catch (err) {
      setEligibilityResult({
        eligible: false,
        refundPercentage: 0,
        eligibilityType: null,
        reason:
          err instanceof Error ? err.message : 'Unable to check refund eligibility right now.',
      });
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget || !eligibilityResult?.eligible || !eligibilityResult.eligibilityType) {
      return;
    }
    setSubmittingRefund(true);
    setErrorMsg(null);
    try {
      const res = await createRefundRequest({
        paymentId: refundTarget.paymentId,
        paymentRef: refundTarget.paymentRef,
        bookingId: refundTarget.bookingId,
        appointmentId: refundTarget.appointmentId,
        patientName: refundTarget.patientDisplay,
        mobileNumber: refundTarget.mobileNumber,
        doctorName: refundTarget.doctorName,
        departmentName: refundTarget.departmentName,
        appointmentDate: refundTarget.appointmentDate,
        timeSlot: refundTarget.timeSlot,
        amount: refundTarget.amount,
        reason: refundReason,
        eligibilityType: eligibilityResult.eligibilityType,
        ownerUid: user?.uid || '',
      });
      setRefundTarget(null);
      setRefundReason('');
      setActiveTab('refunds');
      setSuccessMsg(
        `Refund request ${res.refundRef} submitted for NPR ${refundTarget.amount}. Hospital Accounts Desk will review it shortly.`
      );
      await hydrateSavedAndSignedIn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit refund request.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <section className="py-12 lg:py-16 bg-slate-50 min-h-[80vh] border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Header & Auth Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-emerald-800">
              Private Patient Portal · Spine X Hospital
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
              Patient Appointments, Payments &amp; Refunds
            </h1>
            <p className="text-sm text-slate-600">
              View only your own verified hospital bookings, Fonepay transaction status, and refund
              requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void hydrateSavedAndSignedIn()}
              disabled={loadingSaved}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingSaved ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign Out ({user.email?.split('@')[0]})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithPopup(auth, googleProvider)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Verified Reference Lookup Bar */}
        <form
          onSubmit={handleVerifiedLookup}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-950">
                Verify &amp; Load Any Booking or Payment Record
              </h2>
              <p className="text-xs text-slate-600">
                Enter your Booking ID (<span className="font-mono">SXH-...</span>) or Payment Ref (
                <span className="font-mono">PAY-...</span>) along with your registered mobile number.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onNavigateToBook}
                className="text-xs font-medium text-[#0F4C81] hover:underline cursor-pointer"
              >
                + New Appointment
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={onNavigateToPay}
                className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
              >
                + Pay Hospital Bill
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <input
              type="text"
              required
              value={lookupRefId}
              onChange={(e) => setLookupRefId(e.target.value.toUpperCase())}
              placeholder="SXH-2026-XXXXXX or PAY-2026-XXXXXX"
              aria-label="Booking ID or Payment Ref"
              className="sm:col-span-5 px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
            />
            <input
              type="tel"
              required
              value={lookupMobile}
              onChange={(e) => setLookupMobile(e.target.value)}
              placeholder="Registered Mobile Number (e.g. 98XXXXXXXX)"
              aria-label="Registered Mobile Number"
              className="sm:col-span-4 px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="sm:col-span-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-300 cursor-pointer"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Verify &amp; Load</span>
            </button>
          </div>
        </form>

        {(errorMsg || successMsg) && (
          <div
            role="status"
            className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
              errorMsg
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {errorMsg ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{errorMsg || successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              aria-label="Close message"
              className="cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'appointments'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
            <span>My Appointments ({unifiedAppointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
            <span>Payment History ({unifiedPayments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refunds')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'refunds'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
            <span>Refund Requests &amp; Status ({unifiedRefunds.length})</span>
          </button>
        </div>

        {/* TAB 1: MY APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            {unifiedAppointments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <p className="font-display font-semibold text-slate-900">
                  No Appointments Loaded Yet
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Enter your Booking ID (<span className="font-mono">SXH-...</span>) and mobile
                  number above, sign in with Google, or book a new OPD slot.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToBook}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                >
                  <span>Book OPD Appointment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {unifiedAppointments.map((appt) => {
                  const linkedPay = unifiedPayments.find(
                    (p) =>
                      (appt.paymentRef && p.paymentRef === appt.paymentRef) ||
                      p.bookingId === appt.bookingId
                  );
                  return (
                    <div
                      key={appt.key}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#0F4C81]">
                            {appt.bookingId}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded border text-xs font-medium capitalize ${
                              APPT_BADGE[appt.status] || APPT_BADGE.pending
                            }`}
                          >
                            {appt.status}
                          </span>
                          {appt.paymentStatus && appt.paymentStatus !== 'unpaid' && (
                            <span
                              className={`px-2.5 py-0.5 rounded border text-xs font-medium ${
                                VERIFICATION_BADGE[appt.paymentStatus] || ''
                              }`}
                            >
                              Payment: {VERIFICATION_LABEL[appt.paymentStatus] || appt.paymentStatus}
                            </span>
                          )}
                        </div>
                        <div className="font-display font-semibold text-slate-950">
                          {appt.doctorName}{' '}
                          <span className="font-normal text-sm text-slate-600">
                            · {appt.departmentName}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-700 font-mono tabular-nums">
                          {appt.appointmentDate} · {appt.timeSlot} ·{' '}
                          {appt.opdFee > 0 ? `NPR ${appt.opdFee}` : 'Confirm at Desk'} · Patient:{' '}
                          {appt.patientDisplay}
                        </div>
                        {appt.adminNote && (
                          <p className="text-xs text-[#0F4C81]">Hospital Note: {appt.adminNote}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {linkedPay && (
                          <button
                            type="button"
                            onClick={() => setSelectedTx(linkedPay)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Payment</span>
                          </button>
                        )}
                        {linkedPay &&
                          linkedPay.verificationStatus === 'verified' &&
                          !refundedPaymentIds.has(linkedPay.paymentId) && (
                            <button
                              type="button"
                              onClick={() => void openRefundChecker(linkedPay)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 text-xs font-medium text-[#0F4C81] hover:bg-sky-100 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Request Refund</span>
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => {
                            removeLocalPatientRecordRef(appt.bookingId, 'appointment');
                            setPortalAppts((prev) =>
                              prev.filter((p) => p.record.bookingId !== appt.bookingId)
                            );
                          }}
                          title="Clear from this browser"
                          aria-label={`Remove ${appt.bookingId} from device list`}
                          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYMENT HISTORY & TRANSACTION DETAILS */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            {unifiedPayments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <p className="font-display font-semibold text-slate-900">
                  No Payment Records Loaded Yet
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Enter your Payment Ref (<span className="font-mono">PAY-...</span>) and mobile
                  number above, or make a new online Fonepay payment.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToPay}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                >
                  <span>Go to Online Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {unifiedPayments.map((pay) => {
                  const hasRefund = refundedPaymentIds.has(pay.paymentId);
                  return (
                    <div
                      key={pay.key}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-[#0F4C81]">
                            {pay.paymentRef}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium capitalize">
                            {pay.paymentCategory} Payment
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded border text-xs font-medium ${
                              VERIFICATION_BADGE[pay.verificationStatus] || ''
                            }`}
                          >
                            {VERIFICATION_LABEL[pay.verificationStatus] || pay.verificationStatus}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-base font-bold text-slate-950">
                            NPR {pay.amount.toLocaleString()}
                          </span>
                          <span className="text-sm font-medium text-slate-800">{pay.purpose}</span>
                        </div>

                        <div className="text-xs text-slate-600 font-mono">
                          Tx ID: {pay.transactionId}
                          {pay.bookingId ? ` · Booking: ${pay.bookingId}` : ''} · {pay.createdAtText}
                        </div>

                        {pay.verificationStatus === 'rejected' && pay.rejectionReason && (
                          <p className="text-xs text-rose-700 font-medium">
                            Rejection Reason: {pay.rejectionReason}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(pay)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Transaction Details</span>
                        </button>

                        {pay.verificationStatus === 'verified' && !hasRefund && (
                          <button
                            type="button"
                            onClick={() => void openRefundChecker(pay)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Request Refund</span>
                          </button>
                        )}

                        {hasRefund && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('refunds')}
                            className="px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-xs font-medium text-[#0F4C81] cursor-pointer"
                          >
                            View Refund Status
                          </button>
                        )}

                        <a
                          href={buildPaymentWhatsAppHref({
                            paymentRef: pay.paymentRef,
                            amount: pay.amount,
                            transactionId: pay.transactionId,
                            patientName: pay.patientDisplay,
                            bookingId: pay.bookingId,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REFUND REQUESTS & REFUND STATUS */}
        {activeTab === 'refunds' && (
          <div className="space-y-6">
            {/* Refund Policy Notice */}
            <div className="p-4 rounded-xl bg-white border border-sky-200 space-y-1.5 text-xs text-slate-700">
              <div className="font-semibold text-[#0F4C81]">
                Spine X Hospital Refund Eligibility Policy
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Normal refund requests are available <strong>at least 24 hours</strong> before the
                  scheduled appointment time, and are unavailable within 24 hours.
                </li>
                <li>
                  Appointments cancelled or rejected by the hospital are eligible for a{' '}
                  <strong>100% refund regardless of the 24-hour restriction</strong>.
                </li>
                <li>
                  Refund status moves through <span className="font-mono">pending</span> →{' '}
                  <span className="font-mono">approved</span> (or{' '}
                  <span className="font-mono">rejected</span>) →{' '}
                  <span className="font-mono">refunded</span> once our Accounts Desk records the
                  actual bank/Fonepay transfer reference.
                </li>
              </ul>
            </div>

            {unifiedRefunds.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <p className="font-display font-semibold text-slate-900">
                  No Refund Requests Submitted
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  If you have a verified payment that meets hospital refund policy, open your Payment
                  History tab and click <strong>Request Refund</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <span>Go to Payment History</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {unifiedRefunds.map((ref) => (
                  <div
                    key={ref.key}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#0F4C81]">
                          {ref.refundRef}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded border text-xs font-medium capitalize ${
                            REFUND_BADGE[ref.status]
                          }`}
                        >
                          {ref.status}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {ref.eligibilityType === 'hospital_cancelled'
                            ? '100% Hospital-Cancelled Policy'
                            : 'Standard (>= 24h Policy)'}
                        </span>
                      </div>

                      <div className="font-mono text-sm font-bold text-slate-950">
                        NPR {ref.amount.toLocaleString()}{' '}
                        <span className="font-normal text-xs text-slate-600">
                          · Payment Ref: {ref.paymentRef}
                          {ref.bookingId ? ` · Booking: ${ref.bookingId}` : ''}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700">Reason: {ref.reason}</p>

                      {ref.refundTxRef && (
                        <p className="text-xs font-medium text-emerald-800">
                          Refund Transfer Reference:{' '}
                          <span className="font-mono font-bold">{ref.refundTxRef}</span>
                        </p>
                      )}
                      {ref.adminNote && (
                        <p className="text-xs text-[#0F4C81]">Accounts Note: {ref.adminNote}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={buildRefundWhatsAppHref({
                          refundRef: ref.refundRef,
                          paymentRef: ref.paymentRef,
                          bookingId: ref.bookingId,
                          amount: ref.amount,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Follow Up on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs text-slate-500">Transaction Receipt Details</p>
                <h3 className="font-display text-lg font-bold text-slate-950 font-mono">
                  {selectedTx.paymentRef}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                aria-label="Close transaction modal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Amount</dt>
                <dd className="font-mono font-bold text-[#0F4C81]">
                  NPR {selectedTx.amount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Verification Status</dt>
                <dd className="font-semibold text-slate-900">
                  {VERIFICATION_LABEL[selectedTx.verificationStatus]}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Fonepay Tx ID</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {selectedTx.transactionId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Patient</dt>
                <dd className="font-medium text-slate-900">{selectedTx.patientDisplay}</dd>
              </div>
              {selectedTx.bookingId && (
                <div className="col-span-2">
                  <dt className="text-slate-500 text-xs">Linked Appointment</dt>
                  <dd className="font-mono text-slate-900">
                    {selectedTx.bookingId} · {selectedTx.doctorName} ({selectedTx.appointmentDate}{' '}
                    {selectedTx.timeSlot})
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-slate-500 text-xs">Purpose</dt>
                <dd className="text-slate-900">{selectedTx.purpose}</dd>
              </div>
            </dl>

            {(selectedTx.screenshotDataUrl || selectedTx.screenshotUrl) && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-700">Uploaded Payment Screenshot</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex justify-center">
                  <img
                    src={selectedTx.screenshotUrl || selectedTx.screenshotDataUrl}
                    alt={`Payment receipt ${selectedTx.paymentRef}`}
                    className="max-h-72 w-auto rounded object-contain"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Eligibility & Submission Modal */}
      {refundTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs text-slate-500">Refund Policy Verification</p>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  Request Refund ({refundTarget.paymentRef})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                aria-label="Close refund dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkingEligibility ? (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" />
                <span>Checking hospital refund policy &amp; appointment window...</span>
              </div>
            ) : eligibilityResult ? (
              eligibilityResult.eligible ? (
                <form onSubmit={handleSubmitRefund} className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                    <div>
                      <div className="font-semibold">
                        Eligible for {eligibilityResult.refundPercentage}% Refund (NPR{' '}
                        {refundTarget.amount.toLocaleString()})
                      </div>
                      <p className="mt-0.5">{eligibilityResult.reason}</p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="refund-reason-input"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      Reason for Refund Request <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      id="refund-reason-input"
                      required
                      minLength={5}
                      maxLength={500}
                      rows={3}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Please briefly explain why you are requesting this refund..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingRefund}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] disabled:opacity-50 cursor-pointer"
                    >
                      {submittingRefund && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Submit Refund Request</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
                    <div>
                      <div className="font-semibold">Not Eligible for Automated Online Refund</div>
                      <p className="mt-1 leading-relaxed">{eligibilityResult.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={HOSPITAL_INFO.whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Contact Accounts Desk</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setRefundTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <Clock3 className="w-4 h-4" />
                <span>Waiting for eligibility check...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
