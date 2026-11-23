import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  ImagePlus,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_OPD_SLOTS } from '../data/hospitalCatalog';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  adminDeleteFeedback,
  adminRejectPayment,
  adminToggleFeedbackPublish,
  adminUpdateRefundStatus,
  adminVerifyPayment,
  fetchFonepayConfigStatus,
  removeDepartment,
  removeDoctor,
  sanitizeSlugId,
  seedCatalogIfEmpty,
  syncOfficialCatalogToFirestore,
  updateAppointmentStatus,
  upsertDepartment,
  upsertDoctor,
  verifyPaymentWithFonepayApi,
} from '../services/hospitalService';
import type {
  Appointment,
  AppointmentStatusValue,
  Department,
  Doctor,
  PatientFeedback,
  PaymentRecord,
  RefundRequest,
  RefundStatus,
} from '../types/hospital';
import { buildWhatsAppReminderHref, REMINDER_TIMING_LABELS } from '../utils/reminderUtils';

interface AdminDashboardProps {
  departments: Department[];
  doctors: Doctor[];
  onCatalogUpdated: () => Promise<void>;
}

type AdminTab =
  | 'appointments'
  | 'payments'
  | 'refunds'
  | 'doctors'
  | 'departments'
  | 'feedback'
  | 'access';

type PaymentFilter = 'all' | 'general' | 'appointment' | 'pending_verification' | 'verified' | 'rejected';

function getTodayPrefix(): { today: string; month: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { today: `${y}-${m}-${d}`, month: `${y}-${m}` };
}

const STATUS_BADGE_MAP: Record<AppointmentStatusValue, string> = {
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  completed: 'bg-sky-50 text-[#0F4C81] border-sky-200',
  rejected: 'bg-rose-50 text-rose-900 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-300',
};

async function compressDoctorPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const size = 360;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas image processing unavailable.'));
          return;
        }
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, size, size);
        // Center-crop square covering top portrait area
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = Math.max(0, (img.height - minSide) * 0.2);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.length > 145000) {
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AdminDashboard({
  departments,
  doctors,
  onCatalogUpdated,
}: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<PatientFeedback[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Payment & Refund management state
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [rejectReasonDrafts, setRejectReasonDrafts] = useState<Record<string, string>>({});
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [previewScreenshotPayment, setPreviewScreenshotPayment] = useState<PaymentRecord | null>(null);
  const [fonepayApiConfigured, setFonepayApiConfigured] = useState(false);

  const [refundFilter, setRefundFilter] = useState<'all' | RefundStatus>('all');
  const [busyRefundId, setBusyRefundId] = useState<string | null>(null);
  const [refundTxDrafts, setRefundTxDrafts] = useState<Record<string, string>>({});
  const [refundNoteDrafts, setRefundNoteDrafts] = useState<Record<string, string>>({});
  const [markingRefundId, setMarkingRefundId] = useState<string | null>(null);

  // Appointment filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'due_reminders' | AppointmentStatusValue
  >('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);

  // Doctor editor state
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Department editor state
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [savingDept, setSavingDept] = useState(false);

  // Extra admin UID addition
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setUnauthorized(false);
      setAuthError(null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Attach real-time listeners ONLY when authenticated
  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setPayments([]);
      setRefunds([]);
      setFeedbackItems([]);
      return;
    }

    let cancelled = false;
    setLoadingAppointments(true);
    setUnauthorized(false);

    fetchFonepayConfigStatus()
      .then((cfg) => {
        if (!cancelled) setFonepayApiConfigured(cfg.apiConfigured);
      })
      .catch(() => {
        if (!cancelled) setFonepayApiConfigured(false);
      });

    const apptQuery = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));
    const unsubAppts = onSnapshot(
      apptQuery,
      async (snapshot) => {
        if (cancelled) return;
        const rows: Appointment[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Appointment, 'id'>),
        }));
        setAppointments(rows);
        setLoadingAppointments(false);
        setUnauthorized(false);

        try {
          const seeded = await seedCatalogIfEmpty();
          if (seeded && !cancelled) {
            await onCatalogUpdated();
          }
        } catch (seedErr) {
          console.warn('Auto-seed skipped:', seedErr);
        }
      },
      (error) => {
        if (cancelled) return;
        setLoadingAppointments(false);
        const msg = error?.message?.toLowerCase() || '';
        if (msg.includes('permission') || msg.includes('insufficient')) {
          setUnauthorized(true);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'appointments');
      }
    );

    const paymentsQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        if (cancelled) return;
        setPayments(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PaymentRecord, 'id'>),
          }))
        );
      },
      (err) => {
        console.warn('Admin payments listener warning:', err);
      }
    );

    const refundsQuery = query(collection(db, 'refunds'), orderBy('createdAt', 'desc'));
    const unsubRefunds = onSnapshot(
      refundsQuery,
      (snapshot) => {
        if (cancelled) return;
        setRefunds(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RefundRequest, 'id'>),
          }))
        );
      },
      (err) => {
        console.warn('Admin refunds listener warning:', err);
      }
    );

    const fbQuery = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
    const unsubFb = onSnapshot(
      fbQuery,
      (snapshot) => {
        if (cancelled) return;
        setFeedbackItems(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PatientFeedback, 'id'>),
          }))
        );
      },
      (err) => {
        console.warn('Admin feedback listener warning:', err);
      }
    );

    return () => {
      cancelled = true;
      unsubAppts();
      unsubPayments();
      unsubRefunds();
      unsubFb();
    };
  }, [user, onCatalogUpdated]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to complete Google Sign-In.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUnauthorized(false);
  };

  const { today, month } = useMemo(() => getTodayPrefix(), []);

  const stats = useMemo(() => {
    const todayCount = appointments.filter((a) => a.appointmentDate === today).length;
    const monthCount = appointments.filter((a) => a.appointmentDate.startsWith(month)).length;
    const pendingCount = appointments.filter((a) => a.status === 'pending').length;
    const dueRemindersCount = appointments.filter(
      (a) =>
        (a.status === 'pending' || a.status === 'approved') &&
        a.reminderStatus === 'pending' &&
        a.appointmentDate >= today
    ).length;
    const monthRevenue = appointments
      .filter(
        (a) =>
          a.appointmentDate.startsWith(month) &&
          (a.status === 'approved' || a.status === 'completed' || a.status === 'pending')
      )
      .reduce((acc, item) => acc + (Number(item.opdFee) || 0), 0);

    return {
      todayCount,
      monthCount,
      pendingCount,
      dueRemindersCount,
      monthRevenue,
    };
  }, [appointments, today, month]);

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((appt) => {
      if (dateFilter && appt.appointmentDate !== dateFilter) return false;
      if (doctorFilter !== 'all' && appt.doctorId !== doctorFilter) return false;
      if (statusFilter === 'due_reminders') {
        if (
          !(
            (appt.status === 'pending' || appt.status === 'approved') &&
            appt.reminderStatus === 'pending' &&
            appt.appointmentDate >= today
          )
        ) {
          return false;
        }
      } else if (statusFilter !== 'all' && appt.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        appt.patientName.toLowerCase().includes(q) ||
        appt.mobileNumber.toLowerCase().includes(q) ||
        appt.bookingId.toLowerCase().includes(q)
      );
    });
  }, [appointments, searchQuery, dateFilter, doctorFilter, statusFilter, today]);

  const handleStatusChange = async (
    appt: Appointment,
    nextStatus: AppointmentStatusValue,
    customNote?: string,
    nextReminderStatus?: 'pending' | 'sent' | 'not_needed'
  ) => {
    setActionError(null);
    setActionMsg(null);
    setUpdatingApptId(appt.id);
    try {
      await updateAppointmentStatus(
        appt,
        nextStatus,
        customNote !== undefined ? customNote : appt.adminNote,
        nextReminderStatus
      );
      setEditingNoteId(null);
      setActionMsg(
        nextReminderStatus === 'sent'
          ? `Marked appointment reminder as sent for ${appt.bookingId}.`
          : `Appointment ${appt.bookingId} updated to ${nextStatus}.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update appointment.');
    } finally {
      setUpdatingApptId(null);
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingDoctor) return;
    setActionError(null);
    setUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressDoctorPhotoFile(file);
      setEditingDoctor({ ...editingDoctor, photoUrl: compressedDataUrl });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not process doctor portrait image.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    setActionError(null);
    setActionMsg(null);
    setSavingDoctor(true);
    try {
      const targetId = isAddingDoctor
        ? sanitizeSlugId(editingDoctor.name) || `doc-${Date.now()}`
        : editingDoctor.id;
      await upsertDoctor({ ...editingDoctor, id: targetId });
      await onCatalogUpdated();
      setEditingDoctor(null);
      setIsAddingDoctor(false);
      setActionMsg(`Saved consultant profile for ${editingDoctor.name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save doctor.');
    } finally {
      setSavingDoctor(false);
    }
  };

  const handleDeleteDoctor = async (doctor: Doctor) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await removeDoctor(doctor.id);
      await onCatalogUpdated();
      setActionMsg(`Removed ${doctor.name} from directory.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to remove doctor.');
    }
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setActionError(null);
    setActionMsg(null);
    setSavingDept(true);
    try {
      const targetId = isAddingDept
        ? sanitizeSlugId(editingDept.name) || `dept-${Date.now()}`
        : editingDept.id;
      await upsertDepartment({ ...editingDept, id: targetId });
      await onCatalogUpdated();
      setEditingDept(null);
      setIsAddingDept(false);
      setActionMsg(`Saved department ${editingDept.name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await removeDepartment(dept.id);
      await onCatalogUpdated();
      setActionMsg(`Removed department ${dept.name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to remove department.');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionMsg(null);
    setSavingAdmin(true);
    const cleanUid = newAdminUid.trim();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: cleanEmail,
        role: 'admin',
        addedAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setActionMsg(`Granted admin access to ${cleanEmail}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add administrator.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const pendingPaymentsCount = useMemo(
    () => payments.filter((p) => p.verificationStatus === 'pending_verification').length,
    [payments]
  );

  const pendingRefundsCount = useMemo(
    () => refunds.filter((r) => r.status === 'pending' || r.status === 'approved').length,
    [refunds]
  );

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    return payments.filter((p) => {
      if (paymentFilter === 'general' && p.paymentCategory !== 'general') return false;
      if (paymentFilter === 'appointment' && p.paymentCategory !== 'appointment') return false;
      if (
        (paymentFilter === 'pending_verification' ||
          paymentFilter === 'verified' ||
          paymentFilter === 'rejected') &&
        p.verificationStatus !== paymentFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.patientName.toLowerCase().includes(q) ||
        p.mobileNumber.toLowerCase().includes(q) ||
        p.transactionId.toLowerCase().includes(q) ||
        p.paymentRef.toLowerCase().includes(q) ||
        p.bookingId.toLowerCase().includes(q)
      );
    });
  }, [payments, paymentFilter, paymentSearch]);

  const filteredRefunds = useMemo(() => {
    if (refundFilter === 'all') return refunds;
    return refunds.filter((r) => r.status === refundFilter);
  }, [refunds, refundFilter]);

  const handleManualVerifyPayment = async (payment: PaymentRecord) => {
    setActionError(null);
    setActionMsg(null);
    setBusyPaymentId(payment.id);
    try {
      const res = await adminVerifyPayment(payment, 'manual_admin', user?.email || 'admin');
      setActionMsg(
        res.appointmentAutoApproved
          ? `Payment ${payment.paymentRef} verified and linked appointment ${payment.bookingId} automatically approved.`
          : `Payment ${payment.paymentRef} marked as Verified.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to verify payment.');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const handleApiVerifyPayment = async (payment: PaymentRecord) => {
    if (!user) return;
    setActionError(null);
    setActionMsg(null);
    setBusyPaymentId(payment.id);
    try {
      const idToken = await user.getIdToken();
      const apiRes = await verifyPaymentWithFonepayApi(idToken, payment);
      if (apiRes.verified) {
        const res = await adminVerifyPayment(payment, 'fonepay_api', user.email || 'admin');
        setActionMsg(
          res.appointmentAutoApproved
            ? `Fonepay API verified ${payment.paymentRef} and auto-approved ${payment.bookingId}.`
            : `Fonepay API verified payment ${payment.paymentRef}.`
        );
      } else {
        setActionError(apiRes.message || 'Fonepay API did not confirm this transaction.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Fonepay API verification error.');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const handleRejectPayment = async (payment: PaymentRecord) => {
    setActionError(null);
    setActionMsg(null);
    setBusyPaymentId(payment.id);
    try {
      const reason = rejectReasonDrafts[payment.id] || '';
      await adminRejectPayment(payment, reason, user?.email || 'admin');
      setRejectingPaymentId(null);
      setActionMsg(`Payment ${payment.paymentRef} marked as Rejected.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to reject payment.');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const handleRefundTransition = async (refund: RefundRequest, nextStatus: RefundStatus) => {
    setActionError(null);
    setActionMsg(null);
    setBusyRefundId(refund.id);
    try {
      const note = refundNoteDrafts[refund.id] ?? refund.adminNote ?? '';
      const txRef = refundTxDrafts[refund.id] ?? refund.refundTxRef ?? '';
      await adminUpdateRefundStatus(refund, nextStatus, note, txRef, user?.email || 'admin');
      setMarkingRefundId(null);
      setActionMsg(`Refund ${refund.refundRef} updated to ${nextStatus}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update refund status.');
    } finally {
      setBusyRefundId(null);
    }
  };

  if (authLoading) {
    return (
      <section className="py-20 bg-slate-50 min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-[#0F4C81]" aria-hidden="true" />
          <span>Checking hospital administrator session...</span>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-20 bg-slate-50 min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0F4C81]">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-950">
              Hospital Admin Portal
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sign in with an authorized Google account to manage patient appointments, consultant
              photos &amp; OPD fees, appointment reminders, patient feedback, and departments.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-lg bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0B3A63] transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </section>
    );
  }

  if (unauthorized) {
    return (
      <section className="py-20 bg-slate-50 min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-rose-200 rounded-xl p-8 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-7 h-7 text-rose-700 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="font-display text-xl font-bold text-slate-950">
                Administrator Authorization Required
              </h1>
              <p className="text-sm text-slate-600">
                Signed in as <span className="font-mono font-medium">{user.email}</span> (UID:{' '}
                <span className="font-mono text-xs">{user.uid}</span>). This account does not have
                hospital administrator permissions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out &amp; Switch Account</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 bg-slate-50 min-h-[80vh]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Top Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">Admin Console / {user.email}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 mt-1">
              Hospital Operations &amp; Appointments
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setActionError(null);
                try {
                  await syncOfficialCatalogToFirestore();
                  await onCatalogUpdated();
                  setActionMsg(
                    'Synchronized official departments, doctors, and portraits to Firestore.'
                  );
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : 'Unable to synchronize catalog.'
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sync Official Catalog</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Daily & Monthly KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Today ({today})</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-[#0F4C81] mt-1">
              {stats.todayCount}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Daily Bookings</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Month ({month})</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-950 mt-1">
              {stats.monthCount}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Monthly Bookings</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Action Required</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-amber-700 mt-1">
              {stats.pendingCount}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Pending Approval</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Reminders Queue</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
              {stats.dueRemindersCount}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Upcoming Pending Alerts</div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Month Est. OPD</div>
            <div className="font-mono tabular-nums text-2xl font-bold text-[#0F4C81] mt-1">
              NPR {stats.monthRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Active OPD Value</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {(
            [
              { id: 'appointments', label: `Appointments (${appointments.length})` },
              {
                id: 'payments',
                label: `Payments (${payments.length}${pendingPaymentsCount > 0 ? ` · ${pendingPaymentsCount} Pending` : ''})`,
              },
              {
                id: 'refunds',
                label: `Refunds (${refunds.length}${pendingRefundsCount > 0 ? ` · ${pendingRefundsCount} Open` : ''})`,
              },
              { id: 'doctors', label: `Doctors (${doctors.length})` },
              { id: 'departments', label: `Departments (${departments.length})` },
              { id: 'feedback', label: `Feedback (${feedbackItems.length})` },
              { id: 'access', label: 'Admin Access' },
            ] as { id: AdminTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(actionMsg || actionError) && (
          <div
            role="status"
            className={`p-4 rounded-lg border text-sm flex items-center justify-between gap-3 ${
              actionError
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span>{actionError || actionMsg}</span>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActionMsg(null);
              }}
              aria-label="Dismiss notice"
              className="cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: APPOINTMENTS & REMINDERS */}
        {activeTab === 'appointments' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, or ID..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                />
              </div>

              <div className="relative">
                <Calendar
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  aria-label="Filter by appointment date"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                />
              </div>

              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                aria-label="Filter by doctor"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0F4C81]"
              >
                <option value="all">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as 'all' | 'due_reminders' | AppointmentStatusValue
                    )
                  }
                  aria-label="Filter by status"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0F4C81]"
                >
                  <option value="all">All Statuses</option>
                  <option value="due_reminders">Due Reminders</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {(searchQuery || dateFilter || doctorFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDateFilter('');
                      setDoctorFilter('all');
                      setStatusFilter('all');
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {loadingAppointments ? (
              <div className="p-12 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Loading patient appointments...</span>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="font-medium text-slate-900">No appointments found</p>
                <p className="text-sm text-slate-500">
                  {appointments.length === 0
                    ? 'Booked appointments from patients will appear here in real time.'
                    : 'Adjust your search or filter criteria to see matching bookings.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredAppointments.map((appt) => {
                  const isBusy = updatingApptId === appt.id;
                  const isEditingNote = editingNoteId === appt.id;
                  return (
                    <div key={appt.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/70">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-mono tabular-nums text-xs font-semibold text-[#0F4C81]">
                              {appt.bookingId}
                            </span>
                            <span className="font-display font-semibold text-slate-950">
                              {appt.patientName}
                            </span>
                            <span className="text-xs text-slate-600 font-mono tabular-nums">
                              {appt.mobileNumber} · Age {appt.age}
                              {appt.gender ? ` · ${appt.gender}` : ''}
                            </span>
                          </div>
                          <div className="text-sm text-slate-700">
                            <span className="font-medium">{appt.doctorName}</span> ·{' '}
                            <span>{appt.departmentName}</span> ·{' '}
                            <span className="font-mono tabular-nums">
                              {appt.appointmentDate} at {appt.timeSlot}
                            </span>{' '}
                            ·{' '}
                            <span className="font-mono tabular-nums">
                              {appt.opdFee > 0 ? `NPR ${appt.opdFee}` : 'Fee at Desk'}
                            </span>
                          </div>
                          {appt.reminderTiming && appt.reminderTiming !== 'none' && (
                            <p className="text-xs text-slate-600 flex items-center gap-1.5">
                              <Bell className="w-3.5 h-3.5 text-[#0F4C81]" aria-hidden="true" />
                              <span>
                                Reminder: {REMINDER_TIMING_LABELS[appt.reminderTiming]} (
                                {appt.reminderChannel}) ·{' '}
                                <strong
                                  className={
                                    appt.reminderStatus === 'sent'
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }
                                >
                                  {appt.reminderStatus === 'sent' ? 'Sent' : 'Pending'}
                                </strong>
                              </span>
                            </p>
                          )}
                          {appt.paymentMethod === 'fonepay_qr' && (
                            <p className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
                              <CreditCard className="w-3.5 h-3.5 text-[#0F4C81]" aria-hidden="true" />
                              <span>
                                Fonepay Payment: <span className="font-mono font-semibold">{appt.paymentRef}</span> · Tx:{' '}
                                <span className="font-mono">{appt.transactionId}</span>
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${
                                  appt.paymentStatus === 'verified'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : appt.paymentStatus === 'rejected'
                                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                                      : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {appt.paymentStatus === 'pending_verification'
                                  ? 'Pending Verification'
                                  : appt.paymentStatus}
                              </span>
                            </p>
                          )}
                          {appt.reason && (
                            <p className="text-xs text-slate-600">Reason: {appt.reason}</p>
                          )}
                          {appt.adminNote && (
                            <p className="text-xs text-[#0F4C81]">Note: {appt.adminNote}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded border text-xs font-medium capitalize ${
                              STATUS_BADGE_MAP[appt.status]
                            }`}
                          >
                            {appt.status}
                          </span>

                          {appt.status !== 'approved' && appt.status !== 'completed' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(appt, 'approved')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          {appt.status !== 'completed' &&
                            appt.status !== 'rejected' &&
                            appt.status !== 'cancelled' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(appt, 'completed')}
                                className="px-3 py-1.5 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] disabled:opacity-50 cursor-pointer"
                              >
                                Complete
                              </button>
                            )}

                          {appt.status === 'pending' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(appt, 'rejected')}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-medium hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                            >
                              Reject
                            </button>
                          )}

                          {(appt.status === 'pending' || appt.status === 'approved') && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(appt, 'cancelled')}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <a
                                href={buildWhatsAppReminderHref({
                                  mobileNumber: appt.mobileNumber,
                                  patientName: appt.patientName,
                                  bookingId: appt.bookingId,
                                  doctorName: appt.doctorName,
                                  appointmentDate: appt.appointmentDate,
                                  timeSlot: appt.timeSlot,
                                  forPatient: true,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100"
                              >
                                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>WhatsApp Remind</span>
                              </a>
                              {appt.reminderStatus !== 'sent' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleStatusChange(appt, appt.status, appt.adminNote, 'sent')
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-sky-300 bg-sky-50 text-[#0F4C81] text-xs font-medium hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
                                >
                                  Mark Reminded
                                </button>
                              )}
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(isEditingNote ? null : appt.id);
                              setNoteDraft(appt.adminNote || '');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                          >
                            {isEditingNote ? 'Close Note' : 'Add Note'}
                          </button>
                        </div>
                      </div>

                      {isEditingNote && (
                        <div className="pt-2 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={300}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Optional note visible on patient status check..."
                            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(appt, appt.status, noteDraft)}
                            className="px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] cursor-pointer"
                          >
                            Save Note
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: PAYMENT MANAGEMENT */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-950">
                    Fonepay QR Payment Verification &amp; History
                  </h2>
                  <p className="text-xs text-slate-600">
                    {fonepayApiConfigured
                      ? 'Official Fonepay Merchant Verification API is configured. Verify via API or inspect receipts manually.'
                      : 'Accounts Desk Manual Verification Mode active. Inspect uploaded receipts & Fonepay statements before verifying.'}
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    placeholder="Search Pay Ref, Tx ID, patient..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: `All (${payments.length})` },
                    {
                      id: 'general',
                      label: `General Payments (${payments.filter((p) => p.paymentCategory === 'general').length})`,
                    },
                    {
                      id: 'appointment',
                      label: `Appointment Payments (${payments.filter((p) => p.paymentCategory === 'appointment').length})`,
                    },
                    {
                      id: 'pending_verification',
                      label: `Pending (${payments.filter((p) => p.verificationStatus === 'pending_verification').length})`,
                    },
                    {
                      id: 'verified',
                      label: `Verified (${payments.filter((p) => p.verificationStatus === 'verified').length})`,
                    },
                    {
                      id: 'rejected',
                      label: `Rejected (${payments.filter((p) => p.verificationStatus === 'rejected').length})`,
                    },
                  ] as { id: PaymentFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPaymentFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      paymentFilter === f.id
                        ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {filteredPayments.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No payment submissions match this filter yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredPayments.map((pay) => {
                    const isBusy = busyPaymentId === pay.id;
                    const isRejecting = rejectingPaymentId === pay.id;
                    return (
                      <div key={pay.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/70">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono text-xs font-bold text-[#0F4C81]">
                                {pay.paymentRef}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium capitalize">
                                {pay.paymentCategory}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded border text-xs font-medium ${
                                  pay.verificationStatus === 'verified'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : pay.verificationStatus === 'rejected'
                                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                                      : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {pay.verificationStatus === 'pending_verification'
                                  ? 'Pending Verification'
                                  : pay.verificationStatus}
                              </span>
                            </div>

                            <div className="text-sm text-slate-900">
                              <span className="font-display font-semibold">{pay.patientName}</span>{' '}
                              · <span className="font-mono text-xs">{pay.mobileNumber}</span> ·{' '}
                              <span className="font-mono font-bold text-[#0F4C81]">
                                NPR {pay.amount.toLocaleString()}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 font-mono">
                              Transaction ID: <strong className="text-slate-900">{pay.transactionId}</strong>
                              {pay.bookingId ? ` · Booking: ${pay.bookingId}` : ''}
                              {pay.doctorName ? ` · ${pay.doctorName}` : ''}
                              {pay.appointmentDate ? ` (${pay.appointmentDate} ${pay.timeSlot})` : ''}
                            </div>

                            <p className="text-xs text-slate-600">Purpose: {pay.purpose}</p>
                            {pay.verifiedBy && (
                              <p className="text-[11px] text-slate-500">
                                Processed by {pay.verifiedBy} ({pay.verificationMode})
                              </p>
                            )}
                            {pay.rejectionReason && (
                              <p className="text-xs text-rose-700">
                                Rejection Reason: {pay.rejectionReason}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {(pay.screenshotDataUrl || pay.screenshotUrl) && (
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshotPayment(pay)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Screenshot</span>
                              </button>
                            )}

                            {pay.verificationStatus !== 'verified' && (
                              <>
                                {fonepayApiConfigured && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleApiVerifyPayment(pay)}
                                    className="px-3 py-1.5 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] disabled:opacity-50 cursor-pointer"
                                  >
                                    Check Fonepay API
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleManualVerifyPayment(pay)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                                >
                                  {pay.paymentCategory === 'appointment'
                                    ? 'Verify & Auto-Approve Appt'
                                    : 'Verify Payment'}
                                </button>
                              </>
                            )}

                            {pay.verificationStatus === 'pending_verification' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  setRejectingPaymentId(isRejecting ? null : pay.id)
                                }
                                className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-medium hover:bg-rose-100 cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>

                        {isRejecting && (
                          <div className="pt-2 flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              maxLength={300}
                              value={rejectReasonDrafts[pay.id] || ''}
                              onChange={(e) =>
                                setRejectReasonDrafts((prev) => ({
                                  ...prev,
                                  [pay.id]: e.target.value,
                                }))
                              }
                              placeholder="Reason for rejecting payment (e.g. Transaction ID not settled)..."
                              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleRejectPayment(pay)}
                              className="px-4 py-2 rounded-lg bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 cursor-pointer"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: REFUND MANAGEMENT */}
        {activeTab === 'refunds' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-950">
                  Patient Refund Requests &amp; Disbursement Log
                </h2>
                <p className="text-xs text-slate-600">
                  Approve or reject eligible refund requests, then record the actual bank/Fonepay
                  refund transaction reference before marking as Refunded.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'pending', 'approved', 'rejected', 'refunded'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setRefundFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize cursor-pointer ${
                      refundFilter === status
                        ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {filteredRefunds.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No refund requests match the selected filter.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredRefunds.map((ref) => {
                    const isBusy = busyRefundId === ref.id;
                    const isMarkingRefunded = markingRefundId === ref.id;
                    return (
                      <div key={ref.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/70">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono text-xs font-bold text-[#0F4C81]">
                                {ref.refundRef}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded border text-xs font-medium capitalize ${
                                  ref.status === 'refunded'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : ref.status === 'approved'
                                      ? 'bg-sky-50 text-[#0F4C81] border-sky-200'
                                      : ref.status === 'rejected'
                                        ? 'bg-rose-50 text-rose-900 border-rose-200'
                                        : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {ref.status}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                {ref.eligibilityType === 'hospital_cancelled'
                                  ? 'Hospital-Cancelled (100%)'
                                  : 'Standard >= 24h Policy'}
                              </span>
                            </div>

                            <div className="text-sm text-slate-900">
                              <span className="font-display font-semibold">{ref.patientName}</span> ·{' '}
                              <span className="font-mono text-xs">{ref.mobileNumber}</span> ·{' '}
                              <span className="font-mono font-bold text-[#0F4C81]">
                                NPR {ref.amount.toLocaleString()}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 font-mono">
                              Payment Ref: {ref.paymentRef}
                              {ref.bookingId ? ` · Booking: ${ref.bookingId}` : ''}
                              {ref.doctorName ? ` · ${ref.doctorName}` : ''}
                              {ref.appointmentDate ? ` (${ref.appointmentDate} ${ref.timeSlot})` : ''}
                            </div>

                            <p className="text-xs text-slate-700">Patient Reason: {ref.reason}</p>
                            {ref.refundTxRef && (
                              <p className="text-xs font-medium text-emerald-800">
                                Refund Transfer Tx Ref:{' '}
                                <span className="font-mono font-bold">{ref.refundTxRef}</span>
                              </p>
                            )}
                            {ref.adminNote && (
                              <p className="text-xs text-[#0F4C81]">Admin Note: {ref.adminNote}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {ref.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleRefundTransition(ref, 'approved')}
                                  className="px-3 py-1.5 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] disabled:opacity-50 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleRefundTransition(ref, 'rejected')}
                                  className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-medium hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {(ref.status === 'pending' || ref.status === 'approved') && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  setMarkingRefundId(isMarkingRefunded ? null : ref.id)
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Mark Refunded</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isMarkingRefunded && (
                          <div className="pt-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <input
                              type="text"
                              required
                              minLength={3}
                              maxLength={100}
                              value={refundTxDrafts[ref.id] || ''}
                              onChange={(e) =>
                                setRefundTxDrafts((prev) => ({
                                  ...prev,
                                  [ref.id]: e.target.value,
                                }))
                              }
                              placeholder="Actual Bank / Fonepay Refund Tx Ref *"
                              className="sm:col-span-5 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                            />
                            <input
                              type="text"
                              maxLength={300}
                              value={refundNoteDrafts[ref.id] ?? ref.adminNote ?? ''}
                              onChange={(e) =>
                                setRefundNoteDrafts((prev) => ({
                                  ...prev,
                                  [ref.id]: e.target.value,
                                }))
                              }
                              placeholder="Optional accounts desk note..."
                              className="sm:col-span-5 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleRefundTransition(ref, 'refunded')}
                              className="sm:col-span-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 cursor-pointer"
                            >
                              Confirm Sent
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DOCTORS (with Individual Photo Upload, Qualifications, Schedule & Fees) */}
        {activeTab === 'doctors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-slate-950">
                Manage Doctors, Photos, Schedules, OPD Fees &amp; Time Slots
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddingDoctor(true);
                  setEditingDoctor({
                    id: '',
                    name: '',
                    specialty: '',
                    qualification: '',
                    nmcNo: '',
                    opdSchedule: '',
                    photoUrl: '',
                    clinicalFocus: '',
                    departmentId: departments[0]?.id || 'orthopedics',
                    opdFee: 400,
                    isAvailable: true,
                    availableSlots: [...DEFAULT_OPD_SLOTS],
                    sortOrder: doctors.length + 1,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs sm:text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Doctor</span>
              </button>
            </div>

            {editingDoctor && (
              <form
                onSubmit={handleSaveDoctor}
                className="bg-white border border-sky-300 rounded-xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-base text-slate-950">
                    {isAddingDoctor ? 'Add New Doctor' : `Edit ${editingDoctor.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoctor(null);
                      setIsAddingDoctor(false);
                    }}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Doctor Portrait Upload Control */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center shrink-0">
                    {editingDoctor.photoUrl ? (
                      <img
                        src={editingDoctor.photoUrl}
                        alt="Doctor preview"
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <ImagePlus className="w-7 h-7 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="text-xs font-semibold text-slate-900">
                      Doctor Profile Photo (Auto-cropped &amp; optimized)
                    </div>
                    <p className="text-xs text-slate-500">
                      Upload a clear portrait photo (JPG, PNG, or WEBP). Leave empty to display a
                      clean clinical placeholder.
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] cursor-pointer">
                        <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{uploadingPhoto ? 'Processing...' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoFileChange}
                          className="sr-only"
                        />
                      </label>
                      {editingDoctor.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingDoctor({ ...editingDoctor, photoUrl: '' })}
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Doctor Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={editingDoctor.name}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, name: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      value={editingDoctor.specialty}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, specialty: e.target.value })
                      }
                      placeholder="e.g. Consultant Physician"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      OPD Fee (NPR, 0 = Confirm at Desk)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={50000}
                      value={editingDoctor.opdFee}
                      onChange={(e) =>
                        setEditingDoctor({
                          ...editingDoctor,
                          opdFee: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Qualification (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={350}
                      value={editingDoctor.qualification || ''}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, qualification: e.target.value })
                      }
                      placeholder="e.g. MBBS, MD"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      OPD Schedule (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={editingDoctor.opdSchedule || ''}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, opdSchedule: e.target.value })
                      }
                      placeholder="Only when provided (e.g. Daily Service)"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      NMC Reg. No. (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={30}
                      value={editingDoctor.nmcNo || ''}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, nmcNo: e.target.value })
                      }
                      placeholder="e.g. 6802"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Department *
                    </label>
                    <select
                      value={editingDoctor.departmentId}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, departmentId: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Clinical Areas / Focus (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      value={editingDoctor.clinicalFocus || ''}
                      onChange={(e) =>
                        setEditingDoctor({ ...editingDoctor, clinicalFocus: e.target.value })
                      }
                      placeholder="Brief verified clinical focus shown in profile modal"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      id="doc-available-toggle"
                      type="checkbox"
                      checked={editingDoctor.isAvailable}
                      onChange={(e) =>
                        setEditingDoctor({
                          ...editingDoctor,
                          isAvailable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[#0F4C81]"
                    />
                    <label
                      htmlFor="doc-available-toggle"
                      className="text-sm font-medium text-slate-800"
                    >
                      Available for Online Booking
                    </label>
                  </div>
                </div>

                {/* Time Slots Manager */}
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      Manage OPD Time Slots ({editingDoctor.availableSlots.length}/16)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={20}
                        value={newSlotInput}
                        onChange={(e) => setNewSlotInput(e.target.value)}
                        placeholder="e.g. 04:30 PM"
                        className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const slot = newSlotInput.trim();
                          if (
                            slot.length >= 3 &&
                            !editingDoctor.availableSlots.includes(slot) &&
                            editingDoctor.availableSlots.length < 16
                          ) {
                            setEditingDoctor({
                              ...editingDoctor,
                              availableSlots: [...editingDoctor.availableSlots, slot],
                            });
                            setNewSlotInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 cursor-pointer"
                      >
                        Add Slot
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {editingDoctor.availableSlots.map((slot) => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono tabular-nums text-slate-800"
                      >
                        <Clock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                        {slot}
                        <button
                          type="button"
                          aria-label={`Remove slot ${slot}`}
                          onClick={() =>
                            setEditingDoctor({
                              ...editingDoctor,
                              availableSlots: editingDoctor.availableSlots.filter(
                                (s) => s !== slot
                              ),
                            })
                          }
                          className="text-slate-400 hover:text-rose-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoctor(null);
                      setIsAddingDoctor(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoctor || uploadingPhoto}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                  >
                    {savingDoctor ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Doctor</span>
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                      {doctor.photoUrl ? (
                        <img
                          src={doctor.photoUrl}
                          alt={doctor.name}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <ImagePlus className="w-5 h-5 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold text-slate-950">
                          {doctor.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {doctor.specialty || 'OPD Consultant'} ·{' '}
                          {departments.find((d) => d.id === doctor.departmentId)?.name ||
                            doctor.departmentId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-mono tabular-nums">
                        OPD Fee: {doctor.opdFee > 0 ? `NPR ${doctor.opdFee}` : 'Confirm at Desk'} ·{' '}
                        {doctor.availableSlots.length} Slots
                        {doctor.opdSchedule ? ` · ${doctor.opdSchedule}` : ''} ·{' '}
                        <span className={doctor.isAvailable ? 'text-emerald-700' : 'text-rose-700'}>
                          {doctor.isAvailable ? 'Available' : 'Paused'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDoctor(false);
                        setEditingDoctor(doctor);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Edit Photo, Fee &amp; Slots
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoctor(doctor)}
                      aria-label={`Remove ${doctor.name}`}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-slate-950">
                Manage Hospital Departments
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddingDept(true);
                  setEditingDept({
                    id: '',
                    name: '',
                    nepaliName: '',
                    summary: '',
                    careScope: '',
                    is24x7: false,
                    isActive: true,
                    sortOrder: departments.length + 1,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs sm:text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Department</span>
              </button>
            </div>

            {editingDept && (
              <form
                onSubmit={handleSaveDept}
                className="bg-white border border-sky-300 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-base text-slate-950">
                    {isAddingDept ? 'Add Department' : `Edit ${editingDept.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDept(null);
                      setIsAddingDept(false);
                    }}
                    className="text-slate-500 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Department Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={editingDept.name}
                      onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nepali Subtitle (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={editingDept.nepaliName || ''}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, nepaliName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Care Scope Line
                    </label>
                    <input
                      type="text"
                      maxLength={400}
                      value={editingDept.careScope}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, careScope: e.target.value })
                      }
                      placeholder="e.g. Inpatient Care · Diagnostics"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Summary *
                    </label>
                    <textarea
                      required
                      rows={2}
                      maxLength={400}
                      value={editingDept.summary}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, summary: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDept.is24x7}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, is24x7: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#0F4C81]"
                    />
                    24/7 Service
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDept.isActive}
                      onChange={(e) =>
                        setEditingDept({ ...editingDept, isActive: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#0F4C81]"
                    />
                    Active for Public Booking
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDept(null);
                      setIsAddingDept(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingDept}
                    className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                  >
                    {savingDept ? 'Saving...' : 'Save Department'}
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-display font-semibold text-slate-950">
                      {dept.name}
                      {dept.nepaliName ? (
                        <span className="text-xs font-normal text-[#0F4C81] ml-2">
                          ({dept.nepaliName})
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-600">{dept.summary}</p>
                    <p className="text-xs text-slate-500">
                      {dept.is24x7 ? 'OPD & Surgical/Inpatient' : 'OPD Service'} ·{' '}
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDept(false);
                        setEditingDept(dept);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDept(dept)}
                      aria-label={`Remove ${dept.name}`}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PATIENT FEEDBACK MODERATION */}
        {activeTab === 'feedback' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <h2 className="font-display text-lg font-semibold text-slate-950">
                Patient Feedback Moderation
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Hide or remove inappropriate reviews, or keep verified patient feedback published.
              </p>
            </div>

            {feedbackItems.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No patient feedback entries have been submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {feedbackItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold text-slate-950 text-sm">
                          {item.patientName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          {item.rating}/5
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.visitType} · {item.departmentName}
                          {item.doctorName ? ` · ${item.doctorName}` : ''}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{item.comment}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          setActionError(null);
                          try {
                            await adminToggleFeedbackPublish(item.id, !item.isPublished);
                            setActionMsg(
                              item.isPublished
                                ? `Hid feedback from ${item.patientName}.`
                                : `Published feedback from ${item.patientName}.`
                            );
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'Unable to update feedback.'
                            );
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                          item.isPublished
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.isPublished ? 'Published (Hide)' : 'Hidden (Publish)'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setActionError(null);
                          try {
                            await adminDeleteFeedback(item.id);
                            setActionMsg(`Deleted feedback from ${item.patientName}.`);
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'Unable to delete feedback.'
                            );
                          }
                        }}
                        aria-label={`Delete feedback by ${item.patientName}`}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN ACCESS */}
        {activeTab === 'access' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-xl">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-slate-950">
                Authorize Additional Hospital Administrator
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Signed-in staff members can view their Firebase UID on the unauthorized screen and
                be added here by an existing administrator.
              </p>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Firebase User UID *
                </label>
                <input
                  type="text"
                  required
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Paste user UID"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Staff Google Email *
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={savingAdmin}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
              >
                {savingAdmin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Grant Admin Access</span>
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>Current Admin UID: {user.uid}</span>
            </div>
          </div>
        )}
      </div>

      {/* Payment Screenshot Lightbox Modal */}
      {previewScreenshotPayment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs text-slate-500">
                  {previewScreenshotPayment.patientName} · NPR{' '}
                  {previewScreenshotPayment.amount.toLocaleString()}
                </p>
                <h3 className="font-mono text-sm font-bold text-[#0F4C81]">
                  {previewScreenshotPayment.paymentRef} · Tx: {previewScreenshotPayment.transactionId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewScreenshotPayment(null)}
                aria-label="Close screenshot preview"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex justify-center">
              <img
                src={
                  previewScreenshotPayment.screenshotUrl ||
                  previewScreenshotPayment.screenshotDataUrl
                }
                alt={`Payment screenshot for ${previewScreenshotPayment.paymentRef}`}
                className="max-h-[65vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
