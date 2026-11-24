import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Printer,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FONEPAY_MERCHANT_INFO, HOSPITAL_INFO } from '../data/hospitalCatalog';
import { auth } from '../lib/firebase';
import {
  checkTransactionIdAvailable,
  createGeneralPayment,
  fetchFonepayConfigStatus,
  type GeneralPaymentConfirmation,
} from '../services/hospitalService';
import {
  buildPaymentWhatsAppHref,
  normalizeTransactionId,
  processPaymentScreenshot,
  saveLocalPatientRecordRef,
} from '../utils/paymentUtils';

interface OnlinePaymentSectionProps {
  onOpenDashboard: () => void;
  onGoToBooking: () => void;
}

const PURPOSE_PRESETS = [
  'Hospital OPD / Consultation Bill',
  'X-Ray / Video X-Ray / Lab Investigation',
  '24-Hour Pharmacy Bill',
  'Emergency / Ward / Admission Deposit',
  'Physiotherapy / Procedure Fee',
];

export function OnlinePaymentSection({
  onOpenDashboard,
  onGoToBooking,
}: OnlinePaymentSectionProps) {
  const [signedInUser, setSignedInUser] = useState<User | null>(auth.currentUser);
  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState(PURPOSE_PRESETS[0]);
  const [bookingId, setBookingId] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const [txCheckStatus, setTxCheckStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate'>('idle');
  const [fonepayApiReady, setFonepayApiReady] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<GeneralPaymentConfirmation | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedInUser(u));
    fetchFonepayConfigStatus()
      .then((cfg) => setFonepayApiReady(cfg.apiConfigured))
      .catch(() => setFonepayApiReady(false));
    return () => unsub();
  }, []);

  const handleTransactionBlur = async () => {
    const clean = normalizeTransactionId(transactionId);
    if (!clean || clean.length < 4) {
      setTxCheckStatus('idle');
      return;
    }
    setTxCheckStatus('checking');
    try {
      const res = await checkTransactionIdAvailable(clean);
      setTxCheckStatus(res.available ? 'available' : 'duplicate');
    } catch {
      setTxCheckStatus('idle');
    }
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingScreenshot(true);
    try {
      const processed = await processPaymentScreenshot(
        file,
        `general-${Date.now()}`,
        signedInUser?.uid || ''
      );
      setScreenshotDataUrl(processed.screenshotDataUrl);
      setScreenshotUrl(processed.screenshotUrl);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not process the selected payment screenshot.'
      );
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!screenshotDataUrl) {
      setErrorMsg('Please upload your Fonepay payment confirmation screenshot.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createGeneralPayment({
        patientName,
        mobileNumber,
        amount: Number(amount),
        transactionId,
        purpose,
        bookingId,
        screenshotDataUrl,
        screenshotUrl,
        ownerUid: signedInUser?.uid || '',
      });

      saveLocalPatientRecordRef({
        refId: result.paymentRef,
        kind: 'payment',
        paymentRef: result.paymentRef,
        bookingId: result.bookingId || undefined,
        mobileNumber: result.mobileNumber,
        amount: result.amount,
        createdAtIso: result.createdAtIso,
      });

      setConfirmation(result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to submit payment record. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setConfirmation(null);
    setAmount('');
    setTransactionId('');
    setBookingId('');
    setScreenshotDataUrl('');
    setScreenshotUrl('');
    setTxCheckStatus('idle');
    setErrorMsg(null);
  };

  const handleCopyRef = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.paymentRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <section className="py-16 lg:py-22 bg-slate-50 min-h-[82vh] border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-slate-200 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-emerald-800">
              Official Hospital Digital Payment Desk
            </p>
            <h1
              className="font-display text-2xl sm:text-3xl lg:text-[36px] font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Online Hospital Payment (Fonepay QR)
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Scan the official Spine X Hospital Fonepay QR below from eSewa, Khalti, IME Pay, or
              any Nepali banking app, then submit your Transaction ID and payment screenshot for
              verification.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onGoToBooking}
              className="px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Book OPD With Payment
            </button>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0F4C81] text-white text-xs sm:text-sm font-semibold hover:bg-[#0A365C] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
              <span>Patient Dashboard</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Official Hospital Fonepay QR & Merchant Verification Info */}
          <div className="lg:col-span-5 space-y-5">
            <div className="surface-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-bold text-[#0F4C81]">
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  <span>Official Fonepay Merchant QR</span>
                </div>
                <span className="text-xs font-semibold text-emerald-800">Verified Terminal</span>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex justify-center">
                <img
                  src={FONEPAY_MERCHANT_INFO.qrImageUrl}
                  alt="Official Fonepay QR for Spine X Superspeciality Hospital and Trauma Center Pvt. Ltd."
                  className="w-full max-w-[290px] h-auto rounded-lg object-contain"
                />
              </div>

              <dl className="space-y-2.5 text-xs text-slate-700 pt-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Merchant</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {FONEPAY_MERCHANT_INFO.merchantName}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Terminal ID</dt>
                  <dd className="font-mono font-bold text-slate-900">
                    {FONEPAY_MERCHANT_INFO.terminalId}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Branch / Bank</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {FONEPAY_MERCHANT_INFO.branch} · {FONEPAY_MERCHANT_INFO.acquiredBy}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-sky-200 bg-sky-50/70 space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-[#0F4C81]">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {fonepayApiReady
                    ? 'Automated Fonepay Merchant Verification Active'
                    : 'Hospital Accounts Desk Payment Verification'}
                </span>
              </div>
              <p className="leading-relaxed">
                {fonepayApiReady
                  ? 'Submitted Transaction IDs are verified against official Fonepay settlement records before approval.'
                  : 'For your security, submitting a Transaction ID and screenshot places the payment in Pending Verification until our Accounts Desk matches it with the hospital Fonepay statement.'}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between gap-3">
              <div className="text-xs text-emerald-950">
                <div className="font-bold">Billing Assistance Desk</div>
                <div className="font-mono mt-0.5">{HOSPITAL_INFO.phone}</div>
              </div>
              <a
                href={HOSPITAL_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WhatsApp Desk</span>
              </a>
            </div>
          </div>

          {/* Right Column: Payment Submission Form or Receipt */}
          <div className="lg:col-span-7">
            {confirmation ? (
              <div className="surface-card rounded-2xl border-emerald-200 p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-700" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      Status: Pending Verification
                    </p>
                    <h2 className="font-display text-2xl font-bold text-slate-950 mt-0.5">
                      Payment Details Submitted Successfully
                    </h2>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Payment Reference ID</div>
                    <div className="font-mono tabular-nums text-xl sm:text-2xl font-bold text-[#0F4C81] mt-0.5">
                      {confirmation.paymentRef}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{copiedRef ? 'Copied' : 'Copy Ref'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Patient Name</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {confirmation.patientName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Mobile Number</dt>
                    <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {confirmation.mobileNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Amount Paid</dt>
                    <dd className="font-mono tabular-nums font-bold text-[#0F4C81] mt-0.5">
                      NPR {confirmation.amount.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Fonepay Transaction ID</dt>
                    <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                      {confirmation.transactionId}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Purpose / Bill Note</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {confirmation.purpose}
                      {confirmation.bookingId ? ` (Booking: ${confirmation.bookingId})` : ''}
                    </dd>
                  </div>
                </dl>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-emerald-950 leading-relaxed">
                    Save your Payment Reference ID (
                    <span className="font-mono font-semibold">{confirmation.paymentRef}</span>) and
                    mobile number to track verification or request an eligible refund in the Patient
                    Dashboard.
                  </p>
                  <a
                    href={buildPaymentWhatsAppHref({
                      paymentRef: confirmation.paymentRef,
                      amount: confirmation.amount,
                      transactionId: confirmation.transactionId,
                      patientName: confirmation.patientName,
                      bookingId: confirmation.bookingId,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send on WhatsApp</span>
                  </a>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="px-5 py-2.5 rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] cursor-pointer"
                  >
                    Track in Patient Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Submit Another Payment
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="surface-card rounded-2xl p-6 sm:p-8 space-y-5"
              >
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    Submit Fonepay Transaction Receipt
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your exact Fonepay Trace / Transaction ID and upload the confirmation
                    screenshot.
                  </p>
                </div>

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
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="pay-patient-name"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Patient Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="pay-patient-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter patient's full name"
                      className="clinical-input px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pay-mobile"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="pay-mobile"
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 98XXXXXXXX"
                      className="clinical-input px-3.5 py-2.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pay-amount"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Payment Amount (NPR) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="pay-amount"
                      type="number"
                      required
                      min={10}
                      max={500000}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="clinical-input px-3.5 py-2.5 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[400, 500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                        amount === String(preset)
                          ? 'bg-sky-50 border-[#0F4C81] text-[#0F4C81]'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-[#0F4C81] hover:text-[#0F4C81]'
                      }`}
                    >
                      NPR {preset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pay-purpose"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Payment Purpose
                    </label>
                    <input
                      id="pay-purpose"
                      type="text"
                      list="pay-purpose-options"
                      maxLength={250}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="clinical-input px-3.5 py-2.5 text-sm"
                    />
                    <datalist id="pay-purpose-options">
                      {PURPOSE_PRESETS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label
                      htmlFor="pay-booking-id"
                      className="block text-sm font-semibold text-slate-800 mb-1.5"
                    >
                      Appointment Booking ID (Optional)
                    </label>
                    <input
                      id="pay-booking-id"
                      type="text"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value.toUpperCase())}
                      placeholder="SXH-2026-XXXXXX"
                      className="clinical-input px-3.5 py-2.5 text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pay-transaction-id"
                    className="block text-sm font-semibold text-slate-800 mb-1.5"
                  >
                    Fonepay Transaction ID / Trace Ref <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="pay-transaction-id"
                    type="text"
                    required
                    minLength={4}
                    maxLength={64}
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value.toUpperCase());
                      setTxCheckStatus('idle');
                    }}
                    onBlur={handleTransactionBlur}
                    placeholder="Enter exact Transaction ID from payment receipt"
                    className="clinical-input px-3.5 py-2.5 text-sm font-mono uppercase"
                  />
                  {txCheckStatus === 'checking' && (
                    <p className="text-xs text-slate-500 mt-1">Checking Transaction ID uniqueness...</p>
                  )}
                  {txCheckStatus === 'available' && (
                    <p className="text-xs font-medium text-emerald-700 mt-1">
                      Transaction ID format verified and unique.
                    </p>
                  )}
                  {txCheckStatus === 'duplicate' && (
                    <p className="text-xs text-rose-700 font-semibold mt-1">
                      This Transaction ID was already submitted. Duplicate submissions are blocked.
                    </p>
                  )}
                </div>

                {/* Payment Screenshot Upload */}
                <div className="space-y-2">
                  <span className="block text-sm font-semibold text-slate-800">
                    Upload Payment Screenshot <span className="text-rose-600">*</span>
                  </span>
                  <div className="p-4 sm:p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center gap-4">
                    {screenshotDataUrl ? (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0">
                        <img
                          src={screenshotDataUrl}
                          alt="Uploaded payment screenshot preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotDataUrl('');
                            setScreenshotUrl('');
                          }}
                          aria-label="Remove screenshot"
                          className="absolute top-1 right-1 p-1 rounded-md bg-slate-900/80 text-white hover:bg-slate-950 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0">
                        <ImagePlus className="w-7 h-7 text-slate-400" aria-hidden="true" />
                      </div>
                    )}

                    <div className="space-y-2.5 flex-1">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Attach a clear screenshot from eSewa, Khalti, IME Pay, or your mobile
                        banking app showing the amount, recipient Spine X Hospital, and Transaction
                        ID.
                      </p>
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer">
                        {uploadingScreenshot ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5 text-[#0F4C81]" aria-hidden="true" />
                        )}
                        <span>
                          {uploadingScreenshot
                            ? 'Compressing & Uploading...'
                            : screenshotDataUrl
                              ? 'Replace Screenshot'
                              : 'Choose Payment Screenshot'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleScreenshotChange}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || uploadingScreenshot || txCheckStatus === 'duplicate'}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl bg-[#0F4C81] text-white text-sm font-semibold shadow-[0_6px_18px_-4px_rgba(15,76,129,0.4)] hover:bg-[#0A365C] disabled:bg-slate-300 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>{submitting ? 'Submitting Payment...' : 'Submit Payment'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
