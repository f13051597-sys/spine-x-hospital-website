import { ArrowRight, Building2, PhoneCall } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { HOSPITAL_INFO, HOSPITAL_PHOTOS } from '../data/hospitalCatalog';

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
  const buildingPhoto = HOSPITAL_PHOTOS[0];

  return (
    <section className="relative bg-gradient-to-b from-[#F4F8FC] via-white to-white border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Clinical Proposition & Primary Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-between space-y-8"
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3.5">
                <img
                  src={HOSPITAL_INFO.logoUrl}
                  alt="Spine X Superspeciality Hospital Logo"
                  className="h-12 w-auto object-contain rounded-lg border border-slate-200/90 bg-white px-2 py-1 shadow-xs"
                />
                <p className="text-xs sm:text-sm font-medium text-emerald-800 leading-snug">
                  {HOSPITAL_INFO.address} · {HOSPITAL_INFO.emergencyAvailability}
                </p>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-slate-950 leading-[1.09]"
                style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.45rem)', textWrap: 'balance' }}
              >
                Spine, Trauma &amp; Multi-Speciality Care in Birtamode
              </h1>

              <p className="text-base sm:text-[17px] text-slate-600 leading-relaxed max-w-[58ch]">
                {HOSPITAL_INFO.name} provides 24-hour emergency and trauma stabilization, adult,
                neonatal &amp; pediatric critical care, specialized outpatient departments, and
                round-the-clock diagnostic and pharmacy support.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={onBookNow}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[46px] rounded-xl bg-[#0F4C81] text-white text-sm font-semibold shadow-[0_6px_18px_-4px_rgba(15,76,129,0.45)] hover:bg-[#0A365C] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Book OPD Appointment</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onCheckStatus}
                  className="inline-flex items-center justify-center px-5 py-3.5 min-h-[46px] rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Check Booking Status
                </button>
              </div>

              <div className="pt-5 border-t border-slate-200/90 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm text-slate-600">
                <a
                  href={HOSPITAL_INFO.phoneHref}
                  className="inline-flex items-center gap-2 font-semibold text-[#0F4C81] hover:text-[#0A365C] transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <span>Emergency:</span>
                  <span className="font-mono tabular-nums">{HOSPITAL_INFO.phone}</span>
                </a>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-xs text-slate-500">{HOSPITAL_INFO.landlines}</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <a
                  href={HOSPITAL_INFO.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-800 hover:underline"
                >
                  WhatsApp Desk
                </a>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Architectural Hospital Facility Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 min-h-[300px] sm:min-h-[380px] lg:min-h-[440px] rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100 relative shadow-[0_18px_40px_-18px_rgba(15,23,42,0.22)]"
          >
            {!imgFailed ? (
              <>
                <img
                  src={buildingPhoto.src}
                  alt={buildingPhoto.alt}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-5 sm:p-6 text-white">
                  <p className="text-xs font-medium text-emerald-300">{buildingPhoto.subtitle}</p>
                  <p className="font-display text-base sm:text-lg font-semibold mt-0.5">
                    {HOSPITAL_INFO.name}
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex flex-col items-center justify-center p-8 text-center">
                <Building2 className="w-12 h-12 text-[#0F4C81] mb-3" aria-hidden="true" />
                <p className="font-display font-semibold text-slate-900">{HOSPITAL_INFO.name}</p>
                <p className="text-sm text-slate-600 mt-1">{HOSPITAL_INFO.address}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Full-Width 4-Column Hospital Key Facts Strip */}
        <div className="mt-10 pt-8 border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="surface-card rounded-xl p-5">
            <div className="font-mono tabular-nums text-2xl sm:text-[26px] font-bold text-[#0F4C81]">
              24/7
            </div>
            <div className="text-sm font-semibold text-slate-950 mt-1">
              Emergency, ICU &amp; Pharmacy
            </div>
            <div className="text-xs text-slate-600 mt-0.5">Continuous triage &amp; critical care</div>
          </div>

          <div className="surface-card rounded-xl p-5">
            <div className="font-mono tabular-nums text-2xl sm:text-[26px] font-bold text-[#0F4C81]">
              {departmentCount}
            </div>
            <div className="text-sm font-semibold text-slate-950 mt-1">Clinical Departments</div>
            <div className="text-xs text-slate-600 mt-0.5">
              Specialized outpatient &amp; surgical care
            </div>
          </div>

          <div className="surface-card rounded-xl p-5">
            <div className="font-mono tabular-nums text-2xl sm:text-[26px] font-bold text-[#0F4C81]">
              {doctorCount}
            </div>
            <div className="text-sm font-semibold text-slate-950 mt-1">Consultant Doctors</div>
            <div className="text-xs text-slate-600 mt-0.5">Verified profiles &amp; slot booking</div>
          </div>

          <a
            href={HOSPITAL_INFO.phoneHref}
            className="rounded-xl p-5 border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition-all block shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="font-mono tabular-nums text-2xl sm:text-[26px] font-bold text-emerald-800">
              {HOSPITAL_INFO.phone}
            </div>
            <div className="text-sm font-semibold text-slate-950 mt-1">Direct Helpline</div>
            <div className="text-xs font-medium text-emerald-800 mt-0.5">
              Tap to call 24/7 desk
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
