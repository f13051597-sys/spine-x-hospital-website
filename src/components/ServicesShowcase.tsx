import { Activity, Ambulance, BedDouble, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';

interface ServicesShowcaseProps {
  onBookNow: () => void;
}

const HOSPITAL_SERVICES = [
  {
    index: '01',
    title: '24/7 Emergency & Trauma Stabilization',
    detail:
      'Immediate triage, fracture stabilization, acute surgical readiness, and direct ambulance reception day and night.',
    icon: Ambulance,
  },
  {
    index: '02',
    title: 'Intensive Care Unit (ICU)',
    detail:
      'Continuous multi-parameter patient monitoring, critical care nursing, and post-operative recovery beds.',
    icon: Activity,
  },
  {
    index: '03',
    title: 'Dedicated Medicine, Surgery & Gynecology Wards',
    detail:
      'Structured inpatient wards supporting general medical admissions, post-surgical care, and women’s health monitoring.',
    icon: BedDouble,
  },
  {
    index: '04',
    title: 'Structured Outpatient (OPD) Scheduling',
    detail:
      'Slot-locked online appointment booking with transparent NPR 400–500 consultation fees and live booking status lookup.',
    icon: Stethoscope,
  },
];

export function ServicesShowcase({ onBookNow }: ServicesShowcaseProps) {
  const [orthoImgFailed, setOrthoImgFailed] = useState(false);
  const [icuImgFailed, setIcuImgFailed] = useState(false);

  return (
    <section className="py-14 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-emerald-800">Hospital Services &amp; Facilities</p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Built for Rapid Trauma Response &amp; Everyday Clinical Care
            </h2>
          </div>
          <button
            type="button"
            onClick={onBookNow}
            className="self-start md:self-auto px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Schedule Outpatient Visit
          </button>
        </div>

        {/* Asymmetric Visual + Editorial Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex flex-col">
            <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
              {!orthoImgFailed ? (
                <img
                  src="/src/assets/images/banner_ortho_spine_1795364623940.jpg"
                  alt="Orthopedic consultation and diagnostic wing at Spine X Hospital"
                  referrerPolicy="no-referrer"
                  onError={() => setOrthoImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-50 to-slate-100 flex items-center justify-center p-6">
                  <ShieldCheck className="w-10 h-10 text-[#0F4C81]" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="p-6 bg-white border-t border-slate-200 flex-1 flex flex-col justify-between space-y-2">
              <div className="text-xs text-slate-500">Outpatient &amp; Spine Wing · Birtamode</div>
              <h3 className="font-display text-lg font-semibold text-slate-950">
                Orthopedic, Spine &amp; Multi-Speciality Outpatient Clinics
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Clean, accessible consultation suites designed for orthopedic trauma follow-ups,
                ENT evaluations, general surgery consultations, and internal medicine visits.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex flex-col">
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {!icuImgFailed ? (
                <img
                  src="/src/assets/images/banner_icu_emergency_1795364800623.jpg"
                  alt="Intensive Care Unit bay prepared for critical patient admission"
                  referrerPolicy="no-referrer"
                  onError={() => setIcuImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-6">
                  <Activity className="w-10 h-10 text-emerald-700" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="p-6 bg-white border-t border-slate-200 flex-1 flex flex-col justify-between space-y-2">
              <div className="text-xs text-emerald-800">Critical &amp; Acute Care · Open 24 Hours</div>
              <h3 className="font-display text-lg font-semibold text-slate-950">
                Intensive Care Unit &amp; 24/7 Emergency Bay
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Continuous bedside physiological monitoring and rapid stabilization for trauma,
                surgical recovery, and acute medical emergencies.
              </p>
            </div>
          </div>
        </div>

        {/* 4-Row Numbered Facility Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {HOSPITAL_SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.index}
                className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-[#0F4C81]">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    {service.index}.
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-950">
                    {service.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{service.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
