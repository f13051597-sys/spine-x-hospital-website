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
    <section className="py-14 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-emerald-800">Patient Experience</p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Patient Feedback &amp; Care Reviews
            </h2>
            <p className="text-sm text-slate-600">
              Share your hospital experience to help our medical and nursing teams improve patient
              care in Birtamode.
            </p>
          </div>

          {averageRating && (
            <div className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" aria-hidden="true" />
                <span className="font-mono tabular-nums text-lg font-bold text-slate-950">
                  {averageRating}
                </span>
              </div>
              <div className="text-xs text-slate-700">
                Based on{' '}
                <span className="font-mono font-semibold">{feedbackList.length}</span> verified{' '}
                {feedbackList.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Submit Feedback Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-950 flex items-center gap-2">
              <MessageSquareHeart className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
              <span>Share Your Patient Feedback</span>
            </h3>

            {submitError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div
                role="status"
                className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Thank you for your feedback. Your review has been recorded.</span>
              </div>
            )}

            <div>
              <label
                htmlFor="feedback-name"
                className="block text-xs font-medium text-slate-800 mb-1"
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
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="feedback-visit-type"
                  className="block text-xs font-medium text-slate-800 mb-1"
                >
                  Service Type <span className="text-rose-600">*</span>
                </label>
                <select
                  id="feedback-visit-type"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as FeedbackVisitType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
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
                  className="block text-xs font-medium text-slate-800 mb-1"
                >
                  Department / Unit <span className="text-rose-600">*</span>
                </label>
                <select
                  id="feedback-department"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
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
                className="block text-xs font-medium text-slate-800 mb-1"
              >
                Doctor Consulted (Optional)
              </label>
              <select
                id="feedback-doctor"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
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
              <span className="block text-xs font-medium text-slate-800 mb-1.5">
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
                      className="p-1.5 rounded-md border border-slate-200 bg-white hover:border-amber-400 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          active ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-mono text-slate-600">{rating}/5</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="feedback-comment"
                className="block text-xs font-medium text-slate-800 mb-1"
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
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-300 transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </form>

          {/* Published Patient Feedback Cards */}
          <div className="lg:col-span-7 space-y-4">
            {loadingList ? (
              <div className="p-10 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" aria-hidden="true" />
                <span>Loading patient reviews...</span>
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="p-10 border border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
                <p className="font-display font-semibold text-slate-900">
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
                    className="p-5 rounded-xl border border-slate-200 bg-white space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display font-semibold text-slate-950 text-sm">
                          {item.patientName}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {item.visitType} · {item.departmentName}
                          {item.doctorName ? ` · ${item.doctorName}` : ''}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-0.5"
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
