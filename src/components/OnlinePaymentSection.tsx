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
    <section className="py-14 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-emerald-800">
              Official Hospital Digital Payment Desk
            </p>
            <h1
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
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
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Book OPD With Payment
            </button>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F4C81] text-white text-xs sm:text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
              <span>Patient Dashboard</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Official Hospital Fonepay QR & Merchant Verification Info */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C81]">
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  <span>Official Fonepay Merchant QR</span>
                </div>
                <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                  Verified Terminal
                </span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3 flex justify-center">
                <img
                  src={FONEPAY_MERCHANT_INFO.qrImageUrl}
                  alt="Official Fonepay QR for Spine X Superspeciality Hospital and Trauma Center Pvt. Ltd."
                  className="w-full max-w-[300px] h-auto rounded-lg object-contain"
                />
              </div>

              <dl className="space-y-2 text-xs text-slate-700 pt-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Merchant</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {FONEPAY_MERCHANT_INFO.merchantName}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Terminal ID</dt>
                  <dd className="font-mono font-semibold text-slate-900">
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

            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/70 space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-[#0F4C81]">
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

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-3">
              <div className="text-xs text-emerald-950">
                <div className="font-semibold">Billing Assistance Desk</div>
                <div className="font-mono mt-0.5">{HOSPITAL_INFO.phone}</div>
              </div>
              <a
                href={HOSPITAL_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WhatsApp Desk</span>
              </a>
            </div>
          </div>

          {/* Right Column: Payment Submission Form or Receipt */}
          <div className="lg:col-span-7">
            {confirmation ? (
              <div className="bg-white border border-emerald-300 rounded-xl p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="w-7 h-7 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-medium text-amber-800">
                      Status: Pending Verification
                    </p>
                    <h2 className="font-display text-2xl font-bold text-slate-950 mt-0.5">
                      Payment Details Submitted Successfully
                    </h2>
                  </div>
                </div>

                <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Payment Reference ID</div>
                    <div className="font-mono tabular-nums text-xl font-bold text-[#0F4C81] mt-0.5">
                      {confirmation.paymentRef}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{copiedRef ? 'Copied' : 'Copy Ref'}</span>
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

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Patient Name</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">{confirmation.patientName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Mobile Number</dt>
                    <dd className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
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
                    Save your Payment Reference ID (<span className="font-mono font-semibold">{confirmation.paymentRef}</span>) and mobile number to track verification or request an eligible refund in the Patient Dashboard.
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Send on WhatsApp</span>
                  </a>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
                  >
                    Track in Patient Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Submit Another Payment
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
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
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="pay-patient-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pay-mobile"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pay-amount"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[400, 500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-mono text-slate-700 hover:border-[#0F4C81] hover:text-[#0F4C81] cursor-pointer"
                    >
                      NPR {preset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pay-purpose"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
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
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Appointment Booking ID (Optional)
                    </label>
                    <input
                      id="pay-booking-id"
                      type="text"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value.toUpperCase())}
                      placeholder="SXH-2026-XXXXXX"
                      className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pay-transaction-id"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
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
                    className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#0F4C81]"
                  />
                  {txCheckStatus === 'checking' && (
                    <p className="text-xs text-slate-500 mt-1">Checking Transaction ID uniqueness...</p>
                  )}
                  {txCheckStatus === 'available' && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Transaction ID format verified and unique.
                    </p>
                  )}
                  {txCheckStatus === 'duplicate' && (
                    <p className="text-xs text-rose-700 font-medium mt-1">
                      This Transaction ID was already submitted. Duplicate submissions are blocked.
                    </p>
                  )}
                </div>

                {/* Payment Screenshot Upload */}
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-slate-800">
                    Upload Payment Screenshot <span className="text-rose-600">*</span>
                  </span>
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-4">
                    {screenshotDataUrl ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0">
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
                          className="absolute top-1 right-1 p-1 rounded bg-slate-900/80 text-white hover:bg-slate-950 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0">
                        <ImagePlus className="w-7 h-7 text-slate-400" aria-hidden="true" />
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Attach a clear screenshot from eSewa, Khalti, IME Pay, or your mobile
                        banking app showing the amount, recipient Spine X Hospital, and Transaction
                        ID.
                      </p>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-100 cursor-pointer">
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
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0B3A63] disabled:bg-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
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
