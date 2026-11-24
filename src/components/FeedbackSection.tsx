import { AlertCircle, CheckCircle2, Loader2, MessageSquareHeart, Star } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPublishedFeedback,
  submitPatientFeedback,
} from '../services/hospitalService';
import type {
  Department,
  Doctor,
  FeedbackVisitType,
  PatientFeedback,
} from '../types/hospital';

interface FeedbackSectionProps {
  departments: Department[];
  doctors: Doctor[];
}

const VISIT_TYPES: FeedbackVisitType[] = [
  'OPD Consultation',
  'Emergency / Trauma',
  'Inpatient Ward',
  'Diagnostics / Lab',
];

export function FeedbackSection({ departments, doctors }: FeedbackSectionProps) {
  const [feedbackList, setFeedbackList] = useState<PatientFeedback[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [patientName, setPatientName] = useState('');
  const [visitType, setVisitType] = useState<FeedbackVisitType>('OPD Consultation');
  const [departmentName, setDepartmentName] = useState(
    departments[0]?.name || 'Orthopedic, Neurology and Spine Diseases'
  );
  const [doctorName, setDoctorName] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadFeedback = useCallback(async () => {
    setLoadingList(true);
    const items = await fetchPublishedFeedback();
    setFeedbackList(items);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    if (departments.length > 0 && !departmentName) {
      setDepartmentName(departments[0].name);
    }
  }, [departments, departmentName]);

  const averageRating = useMemo(() => {
    if (feedbackList.length === 0) return null;
    const sum = feedbackList.reduce((acc, item) => acc + (Number(item.rating) || 0), 0);
    return (sum / feedbackList.length).toFixed(1);
  }, [feedbackList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmitting(true);
    try {
      const created = await submitPatientFeedback({
        patientName,
        departmentName,
        doctorName,
        visitType,
        rating,
        comment,
      });
      setFeedbackList((prev) => [created, ...prev]);
      setPatientName('');
      setDoctorName('');
      setRating(5);
      setComment('');
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit feedback right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-16 lg:py-24 bg-slate-50/50 border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Patient Experience
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Patient Feedback &amp; Care Reviews
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Share your hospital experience to help our medical and nursing teams improve patient
              care in Birtamode.
            </p>
          </div>

          {averageRating && (
            <div className="surface-card px-5 py-3.5 rounded-2xl border-emerald-200/80 bg-emerald-50/50 flex items-center gap-3.5 self-start md:self-auto">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" aria-hidden="true" />
                <span className="font-mono tabular-nums text-xl font-bold text-slate-950">
                  {averageRating}
                </span>
              </div>
              <div className="text-xs text-slate-700 leading-snug">
                Average rating from{' '}
                <span className="font-mono font-bold text-slate-950">{feedbackList.length}</span>{' '}
                verified {feedbackList.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Submit Feedback Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 surface-card rounded-2xl p-6 sm:p-7 space-y-4.5"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
                <MessageSquareHeart className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Share Your Patient Feedback
              </h3>
            </div>

            {submitError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Thank you for your feedback. Your review has been recorded.</span>
              </div>
            )}

            <div>
              <label
                htmlFor="feedback-name"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Your Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="feedback-name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Sita Rai"
                className="clinical-input px-3.5 py-2.5 text-sm min-h-[42px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="feedback-visit-type"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Service Type <span className="text-rose-600">*</span>
                </label>
                <select
                  id="feedback-visit-type"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as FeedbackVisitType)}
                  className="clinical-input px-3 py-2.5 text-sm min-h-[42px]"
                >
                  {VISIT_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="feedback-department"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Department / Unit <span className="text-rose-600">*</span>
                </label>
                <select
                  id="feedback-department"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="clinical-input px-3 py-2.5 text-sm min-h-[42px]"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                  <option value="24-Hour Emergency & Trauma">24-Hour Emergency &amp; Trauma</option>
                  <option value="Laboratory & X-ray Diagnostics">Laboratory &amp; X-ray Diagnostics</option>
                  <option value="ICU / NICU / PICU Care">ICU / NICU / PICU Care</option>
                  <option value="Pharmacy & Physiotherapy">Pharmacy &amp; Physiotherapy</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="feedback-doctor"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Doctor Consulted (Optional)
              </label>
              <select
                id="feedback-doctor"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="clinical-input px-3.5 py-2.5 text-sm min-h-[42px]"
              >
                <option value="">General Hospital Experience</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.name}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-800 mb-1.5">
                Rating <span className="text-rose-600">*</span>
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const active = starVal <= rating;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      aria-label={`Rate ${starVal} out of 5 stars`}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'border-amber-300 bg-amber-50/70'
                          : 'border-slate-200 bg-white hover:border-amber-300'
                      }`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          active ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-mono font-semibold text-slate-600">
                  {rating}/5
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="feedback-comment"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Feedback Message <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="feedback-comment"
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with consultation, nursing care, cleanliness, or registration..."
                className="clinical-input px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] disabled:bg-slate-300 shadow-xs transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </form>

          {/* Published Patient Feedback Cards */}
          <div className="lg:col-span-7 space-y-4">
            {loadingList ? (
              <div className="surface-card p-10 rounded-2xl flex items-center justify-center gap-2.5 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" aria-hidden="true" />
                <span>Loading patient reviews...</span>
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="surface-card p-10 rounded-2xl text-center space-y-2">
                <p className="font-display font-bold text-slate-900">
                  No published patient reviews yet
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Visited Spine X Superspeciality Hospital recently? Submit your feedback on the
                  left to share your experience.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {feedbackList.slice(0, 6).map((item) => (
                  <article
                    key={item.id}
                    className="surface-card surface-card-hover p-5 sm:p-6 rounded-2xl space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-bold text-slate-950 text-sm sm:text-base">
                          {item.patientName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.visitType} · {item.departmentName}
                          {item.doctorName ? ` · ${item.doctorName}` : ''}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-0.5 pt-0.5"
                        aria-label={`Rated ${item.rating} out of 5`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-4 h-4 ${
                              n <= item.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{item.comment}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
