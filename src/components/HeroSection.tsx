import { ArrowRight, Building2, PhoneCall } from 'lucide-react';
import { useState } from 'react';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';

interface HeroSectionProps {
  departmentCount: number;
  doctorCount: number;
  onBookNow: () => void;
  onCheckStatus: () => void;
}

export function HeroSection({
  departmentCount,
  doctorCount,
  onBookNow,
  onCheckStatus,
}: HeroSectionProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              <p className="text-sm font-medium text-emerald-800">
                {HOSPITAL_INFO.address} · {HOSPITAL_INFO.emergencyAvailability}
              </p>

              <h1
                className="font-display font-bold tracking-tight text-slate-950 leading-[1.12]"
                style={{ fontSize: 'clamp(2.15rem, 3.8vw, 3.35rem)', textWrap: 'balance' }}
              >
                Spine, Trauma &amp; Multi-Speciality Care in Birtamode
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-[60ch]">
                {HOSPITAL_INFO.name} provides 24/7 emergency trauma response, intensive care,
                orthopedics, surgery, medicine, and gynecology inpatient wards with transparent
                online OPD scheduling.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onBookNow}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Book OPD Appointment
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onCheckStatus}
                  className="inline-flex items-center px-5 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Check Booking Status
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                <a
                  href={HOSPITAL_INFO.phoneHref}
                  className="inline-flex items-center gap-2 font-medium text-[#0F4C81] hover:underline"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <span>24/7 Emergency Helpline:</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {HOSPITAL_INFO.phone}
                  </span>
                </a>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  |
                </span>
                <a
                  href={HOSPITAL_INFO.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-800 hover:underline"
                >
                  WhatsApp Desk
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Architectural Exterior Image */}
          <div className="lg:col-span-6 min-h-[260px] sm:min-h-[340px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            {!imgFailed ? (
              <img
                src="/src/assets/images/hero_hospital_exterior_1795364799992.jpg"
                alt="Spine X Superspeciality Hospital and Trauma Centre Pvt. Ltd. exterior in Birtamode, Jhapa, Nepal"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full lg:h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex flex-col items-center justify-center p-8 text-center">
                <Building2 className="w-12 h-12 text-[#0F4C81] mb-3" aria-hidden="true" />
                <p className="font-display font-semibold text-slate-900">{HOSPITAL_INFO.name}</p>
                <p className="text-sm text-slate-600 mt-1">{HOSPITAL_INFO.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Full-Width 4-Column Hospital Key Facts Strip */}
        <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F4C81]">24/7</div>
            <div className="text-sm font-medium text-slate-900 mt-1">Emergency &amp; Trauma</div>
            <div className="text-xs text-slate-600 mt-0.5">Continuous triage &amp; ICU support</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F4C81]">
              {departmentCount}
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">Clinical Departments</div>
            <div className="text-xs text-slate-600 mt-0.5">Specialized OPD &amp; inpatient wards</div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="font-mono tabular-nums text-2xl font-semibold text-[#0F4C81]">
              {doctorCount}
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">OPD Consultants</div>
            <div className="text-xs text-slate-600 mt-0.5">Transparent NPR 400–500 fees</div>
          </div>
          <a
            href={HOSPITAL_INFO.phoneHref}
            className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 transition-colors block"
          >
            <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-800">
              {HOSPITAL_INFO.phone}
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">Direct Call Desk</div>
            <div className="text-xs text-emerald-800 mt-0.5">Tap to call emergency desk</div>
          </a>
        </div>
      </div>
    </section>
  );
}
