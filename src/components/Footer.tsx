import { MessageCircle, MessageSquareText, PhoneCall } from 'lucide-react';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';
import type { HospitalView } from '../types/hospital';

interface FooterProps {
  onNavigate: (view: HospitalView) => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
}

export function Footer({ onNavigate, onToggleChat, isChatOpen }: FooterProps) {
  return (
    <>
      <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={HOSPITAL_INFO.logoUrl}
                alt="Spine X Hospital Logo"
                className="h-10 w-auto rounded bg-white px-1.5 py-0.5 object-contain"
              />
              <div className="font-display text-base sm:text-lg font-bold text-white leading-snug">
                {HOSPITAL_INFO.name}
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              {HOSPITAL_INFO.address} · {HOSPITAL_INFO.emergencyAvailability}
            </p>
            <p className="text-xs font-mono text-slate-400">
              Tel: {HOSPITAL_INFO.landlines} | Helpline: {HOSPITAL_INFO.phone}
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href={HOSPITAL_INFO.phoneHref}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0F4C81] text-white text-xs font-medium hover:bg-[#0B3A63] transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-mono tabular-nums">Call {HOSPITAL_INFO.phone}</span>
              </a>
              <a
                href={HOSPITAL_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-800 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WhatsApp Desk</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2.5 text-sm">
            <div className="font-display font-semibold text-white text-xs uppercase tracking-wider">
              Patient Services
            </div>
            <ul className="space-y-2">
              {(
                [
                  { id: 'departments', label: 'Departments' },
                  { id: 'doctors', label: 'Doctor Directory' },
                  { id: 'book', label: 'Book OPD Appointment' },
                  { id: 'status', label: 'Check Booking Status' },
                ] as { id: HospitalView; label: string }[]
              ).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5 text-sm">
            <div className="font-display font-semibold text-white text-xs uppercase tracking-wider">
              Hospital Information
            </div>
            <ul className="space-y-2">
              {(
                [
                  { id: 'about', label: 'About Us' },
                  { id: 'contact', label: 'Contact & Directions' },
                  { id: 'faq', label: 'Frequently Asked Questions' },
                  { id: 'privacy', label: 'Privacy Policy' },
                  { id: 'admin', label: 'Admin Portal' },
                ] as { id: HospitalView; label: string }[]
              ).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              &copy; {new Date().getFullYear()} {HOSPITAL_INFO.name}
            </span>
            <span>{HOSPITAL_INFO.address}</span>
          </div>
        </div>
      </footer>

      {/* Compact Quick-Action Floating Controls (within 15% mobile cap) */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 print:hidden">
        <a
          href={HOSPITAL_INFO.phoneHref}
          aria-label={`Call 24/7 Emergency ${HOSPITAL_INFO.phone}`}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#0F4C81] text-white text-xs font-semibold shadow-md hover:bg-[#0B3A63] transition-colors"
        >
          <PhoneCall className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline font-mono tabular-nums">{HOSPITAL_INFO.phone}</span>
          <span className="sm:hidden">Call</span>
        </a>
        <a
          href={HOSPITAL_INFO.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact Spine X Hospital on WhatsApp"
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold shadow-md hover:bg-emerald-800 transition-colors"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={onToggleChat}
          aria-expanded={isChatOpen}
          aria-label={isChatOpen ? 'Close Hospital Assistant' : 'Open Hospital Assistant'}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <MessageSquareText className="w-4 h-4" aria-hidden="true" />
          <span>Assistant</span>
        </button>
      </div>
    </>
  );
}
