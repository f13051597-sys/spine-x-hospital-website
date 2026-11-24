import {
  Activity,
  Ambulance,
  Baby,
  BedDouble,
  CalendarClock,
  FlaskConical,
  HeartPulse,
  Hospital,
  Pill,
  Scan,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useState } from 'react';
import {
  HOSPITAL_INFO,
  HOSPITAL_PHOTOS,
  OFFICIAL_OTHER_SERVICES,
} from '../data/hospitalCatalog';

interface ServicesShowcaseProps {
  onBookNow: () => void;
}

const DIAGNOSTIC_ICONS = [Sparkles, Scan, FlaskConical, Pill];
const WARD_ICONS = [
  Activity,
  Baby,
  HeartPulse,
  Stethoscope,
  Baby,
  BedDouble,
  Ambulance,
  Hospital,
  BedDouble,
];

export function ServicesShowcase({ onBookNow }: ServicesShowcaseProps) {
  const [orthoImgFailed, setOrthoImgFailed] = useState(false);
  const [icuImgFailed, setIcuImgFailed] = useState(false);
  const [failedCampusPhotos, setFailedCampusPhotos] = useState<Record<string, boolean>>({});

  return (
    <section className="py-16 lg:py-22 bg-white border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-emerald-800">Hospital Services &amp; Facilities</p>
            <h2
              className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Diagnostics, Critical Care, Wards &amp; 24-Hour Emergency
            </h2>
          </div>
          <button
            type="button"
            onClick={onBookNow}
            className="self-start md:self-auto px-5 py-2.5 min-h-[42px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Schedule Outpatient Visit
          </button>
        </div>

        {/* Asymmetric Visual Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 surface-card rounded-2xl overflow-hidden flex flex-col">
            <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
              {!orthoImgFailed ? (
                <img
                  src="/src/assets/images/banner_ortho_spine_1795364623940.jpg"
                  alt="Consultation and outpatient care suites at Spine X Hospital in Birtamode"
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
            <div className="p-6 sm:p-7 bg-white border-t border-slate-100 flex-1 flex flex-col justify-between space-y-2.5">
              <div className="text-xs font-medium text-slate-500">
                Outpatient &amp; Diagnostic Wing · Bhagwan Chowk, Birtamode
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                Integrated Outpatient Consultation &amp; Diagnostic Support
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Clean consultation suites backed by in-house imaging, pathology, physiotherapy,
                and round-the-clock pharmacy access for smooth patient care.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 surface-card rounded-2xl overflow-hidden flex flex-col">
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {!icuImgFailed ? (
                <img
                  src="/src/assets/images/banner_icu_emergency_1795364800623.jpg"
                  alt="Critical care and monitoring bay at Spine X Hospital"
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
            <div className="p-6 sm:p-7 bg-white border-t border-slate-100 flex-1 flex flex-col justify-between space-y-2.5">
              <div className="text-xs font-semibold text-emerald-800">
                Critical &amp; Inpatient Wing · Open 24 Hours
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-slate-950">
                Adult, Neonatal &amp; Pediatric Intensive Monitoring
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Continuous bedside monitoring and dedicated surgical recovery, trauma, and medical
                inpatient beds coordinated round the clock.
              </p>
            </div>
          </div>
        </div>

        {/* Real Hospital Building & Emergency Entrance Photos */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h3 className="font-display text-lg font-bold text-slate-950">
              Hospital Building &amp; Emergency Wing Photos
            </h3>
            <span className="text-xs font-medium text-slate-500">Bhagwan Chowk, Birtamode-3</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOSPITAL_PHOTOS.map((photo) => {
              const failed = failedCampusPhotos[photo.id];
              return (
                <figure
                  key={photo.id}
                  className="surface-card rounded-2xl overflow-hidden flex flex-col group"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                    {!failed ? (
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        onError={() =>
                          setFailedCampusPhotos((prev) => ({ ...prev, [photo.id]: true }))
                        }
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center p-6">
                        <Hospital className="w-8 h-8 text-[#0F4C81]" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <figcaption className="p-5 space-y-1.5 flex-1">
                    <div className="text-xs font-semibold text-emerald-800">{photo.subtitle}</div>
                    <h4 className="font-display text-sm font-bold text-slate-950">
                      {photo.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{photo.caption}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>

        {/* Category 2: Other Services (#6 - #18) */}
        <div className="space-y-10">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Other Services — Diagnostics, Therapy &amp; 24-Hour Pharmacy
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">06 – 09</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {OFFICIAL_OTHER_SERVICES.diagnosticsAndSupport.map((item, idx) => {
                const Icon = DIAGNOSTIC_ICONS[idx] || Stethoscope;
                return (
                  <div
                    key={item.index}
                    className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 space-y-3 hover:bg-white hover:border-sky-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0F4C81]">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {item.index}.
                      </span>
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-slate-950 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs font-medium text-[#0F4C81] mt-1">{item.nepali}</p>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Other Services — Critical Care Units, Wards &amp; Cabins
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">10 – 18</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OFFICIAL_OTHER_SERVICES.criticalCareAndWards.map((item, idx) => {
                const Icon = WARD_ICONS[idx] || BedDouble;
                return (
                  <div
                    key={item.index}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white flex items-start gap-3.5 hover:border-sky-200 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-800">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          {item.index}.
                        </span>
                        <h4 className="font-display text-sm font-bold text-slate-950">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category 3: Emergency and OPD (#19 - #20) */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Emergency and OPD Services
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">19 – 20</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Ambulance className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
                      19.
                    </div>
                    <h4 className="font-display text-base font-bold text-slate-950">
                      {OFFICIAL_OTHER_SERVICES.emergencyAndOpd[0].title}
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {OFFICIAL_OTHER_SERVICES.emergencyAndOpd[0].detail}
                    </p>
                  </div>
                </div>
                <a
                  href={HOSPITAL_INFO.phoneHref}
                  className="px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0 text-center"
                >
                  Call {HOSPITAL_INFO.phone}
                </a>
              </div>

              <div className="p-6 rounded-2xl border border-sky-200 bg-sky-50/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#0F4C81] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CalendarClock className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-mono tabular-nums font-semibold text-[#0F4C81]">
                      20.
                    </div>
                    <h4 className="font-display text-base font-bold text-slate-950">
                      {OFFICIAL_OTHER_SERVICES.emergencyAndOpd[1].title}
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {OFFICIAL_OTHER_SERVICES.emergencyAndOpd[1].detail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBookNow}
                  className="px-4 py-2.5 rounded-xl bg-[#0F4C81] text-white text-xs font-semibold hover:bg-[#0A365C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Book Daily OPD
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
