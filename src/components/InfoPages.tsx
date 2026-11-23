import { ChevronDown, MailCheck, MapPin, MessageCircle, PhoneCall, Shield } from 'lucide-react';
import { useState } from 'react';
import { HOSPITAL_FAQS, HOSPITAL_INFO, HOSPITAL_PHOTOS } from '../data/hospitalCatalog';
import { LocationSection } from './LocationSection';

export function AboutPage({ onBookNow }: { onBookNow: () => void }) {
  return (
    <div className="bg-white">
      <section className="py-14 lg:py-20 border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3">
              <img
                src={HOSPITAL_INFO.logoUrl}
                alt="Spine X Hospital Logo"
                className="h-12 w-auto object-contain rounded border border-slate-200 bg-white px-2 py-1"
              />
              <p className="text-xs font-medium text-emerald-800">About Our Hospital</p>
            </div>
            <h1
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              {HOSPITAL_INFO.name}
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              Located at {HOSPITAL_INFO.address}, Spine X Superspeciality Hospital &amp; Trauma Center
              Pvt. Ltd. delivers organized outpatient consultation, surgical care, orthopedic and
              spine trauma management, neonatal &amp; pediatric services, intensive monitoring, and
              24-hour emergency medical services for patients across Jhapa and eastern Nepal.
            </p>
            <p className="text-base text-slate-600 leading-relaxed">
              Our integrated clinical campus combines specialized consultation suites, advanced
              laboratory and imaging services, physiotherapy, ICU/NICU/PICU critical care, inpatient
              wards, cabin facilities, and 24-hour pharmacy support under streamlined digital
              appointment coordination.
            </p>

            <div className="pt-2 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={onBookNow}
                className="px-5 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] cursor-pointer"
              >
                Book OPD Appointment
              </button>
              <a
                href={HOSPITAL_INFO.phoneHref}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50"
              >
                Call Emergency Desk ({HOSPITAL_INFO.phone})
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {HOSPITAL_PHOTOS.slice(0, 2).map((photo) => (
                <figure
                  key={photo.id}
                  className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="aspect-[4/3] w-full object-cover object-center"
                  />
                  <figcaption className="px-3 py-2 text-xs font-medium text-slate-800">
                    {photo.title}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
              <h2 className="font-display text-lg font-semibold text-slate-950">
                Core Clinical Commitments
              </h2>
            <ul className="space-y-4 text-sm text-slate-700">
              <li className="pb-4 border-b border-slate-200">
                <span className="font-semibold text-slate-900 block">
                  01. Round-the-Clock Emergency &amp; Pharmacy Readiness
                </span>
                <span className="text-slate-600">
                  24-Hour Emergency &amp; Trauma Services, ICU, NICU, PICU, and 24-Hour Pharmacy
                  access prepared for acute medical and surgical admissions.
                </span>
              </li>
              <li className="pb-4 border-b border-slate-200">
                <span className="font-semibold text-slate-900 block">
                  02. Transparent OPD Consultation &amp; Appointment Reminders
                </span>
                <span className="text-slate-600">
                  Clear NPR consultation fees, slot-locked booking, and patient reminder tools
                  before visiting the hospital desk.
                </span>
              </li>
              <li>
                <span className="font-semibold text-slate-900 block">
                  03. Protected Patient Confidentiality
                </span>
                <span className="text-slate-600">
                  Appointment records are safeguarded behind role-verified hospital administration
                  controls.
                </span>
              </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <LocationSection />
    </div>
  );
}

export function ContactPage({ onBookNow }: { onBookNow: () => void }) {
  return (
    <div className="bg-slate-50">
      <section className="py-14 lg:py-16 bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-emerald-800">Contact &amp; Emergency Desk</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
              Get in Touch with {HOSPITAL_INFO.shortName}
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Reach our hospital reception, 24-hour emergency line, or WhatsApp desk directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <a
              href={HOSPITAL_INFO.phoneHref}
              className="p-6 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-sky-300 transition-colors space-y-3"
            >
              <PhoneCall className="w-6 h-6 text-[#0F4C81]" aria-hidden="true" />
              <div className="font-display font-semibold text-slate-950">24/7 Emergency Phone</div>
              <div className="font-mono tabular-nums text-lg font-bold text-[#0F4C81]">
                {HOSPITAL_INFO.phone}
              </div>
              <div className="font-mono text-xs text-slate-600">
                Landline: {HOSPITAL_INFO.landlines}
              </div>
            </a>

            <a
              href={HOSPITAL_INFO.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 transition-colors space-y-3"
            >
              <MessageCircle className="w-6 h-6 text-emerald-800" aria-hidden="true" />
              <div className="font-display font-semibold text-slate-950">WhatsApp Desk</div>
              <div className="font-mono tabular-nums text-lg font-bold text-emerald-800">
                +977 {HOSPITAL_INFO.phone}
              </div>
              <div className="text-xs text-emerald-900">Direct chat for OPD inquiries</div>
            </a>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <MapPin className="w-6 h-6 text-[#0F4C81]" aria-hidden="true" />
              <div className="font-display font-semibold text-slate-950">Hospital Address</div>
              <div className="text-sm font-medium text-slate-900">{HOSPITAL_INFO.address}</div>
              <button
                type="button"
                onClick={onBookNow}
                className="text-xs font-semibold text-[#0F4C81] hover:underline cursor-pointer"
              >
                Book OPD Visit Online
              </button>
            </div>
          </div>
        </div>
      </section>
      <LocationSection />
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-800">Patient Help</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {HOSPITAL_FAQS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-display font-semibold text-sm sm:text-base text-slate-950">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <section className="py-14 lg:py-20 bg-white border-b border-slate-200">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex items-center gap-3 text-[#0F4C81]">
          <Shield className="w-6 h-6" aria-hidden="true" />
          <p className="text-xs font-medium">Patient Confidentiality</p>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          Privacy Policy
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed">
          {HOSPITAL_INFO.name} ({HOSPITAL_INFO.address}) respects the privacy and confidentiality of
          every patient and visitor using our online OPD appointment booking and status lookup
          system.
        </p>

        <div className="space-y-5 pt-2 text-sm text-slate-700 leading-relaxed">
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <h2 className="font-display font-semibold text-slate-950">
              01. Information Collected During Appointment Booking
            </h2>
            <p>
              When you submit an appointment request, we collect your name, mobile number, age,
              optional gender, selected department and doctor, preferred date and time slot, reminder
              preferences, and optional reason for visit solely to coordinate your hospital
              consultation.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <h2 className="font-display font-semibold text-slate-950">
              02. Strict Access Control &amp; Isolation
            </h2>
            <p>
              Patient appointment records are protected by server-enforced database security rules.
              Public visitors and other patients cannot read, search, or access your appointment
              record or mobile number. Only authorized hospital administrators authenticated through
              verified accounts can view and manage appointment requests.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <h2 className="font-display font-semibold text-slate-950">
              03. Verified Status Lookup Protection
            </h2>
            <p>
              Appointment status verification requires both your unique Booking ID and the exact
              mobile number used during booking. Status records never expose your mobile number or
              full personal profile to public queries.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <h2 className="font-display font-semibold text-slate-950">
              04. Contact Regarding Patient Data
            </h2>
            <p className="flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                For inquiries regarding appointment records or updates, contact the hospital desk at{' '}
                <a href={HOSPITAL_INFO.phoneHref} className="font-mono font-semibold underline">
                  {HOSPITAL_INFO.phone}
                </a>{' '}
                or <span className="font-mono">{HOSPITAL_INFO.landlines}</span>.
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
