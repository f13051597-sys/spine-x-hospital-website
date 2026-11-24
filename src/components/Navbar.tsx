import { CalendarCheck, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { HospitalView } from '../types/hospital';

interface NavbarProps {
  activeView: HospitalView;
  onNavigate: (view: HospitalView) => void;
}

const PRIMARY_NAV_ITEMS: { id: HospitalView; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'departments', label: 'Departments' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'pay', label: 'Online Payment' },
  { id: 'dashboard', label: 'Patient Dashboard' },
  { id: 'status', label: 'Check Status' },
];

const MOBILE_EXTRA_ITEMS: { id: HospitalView; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'about', label: 'About Us' },
  { id: 'faq', label: 'FAQ' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'admin', label: 'Admin Portal' },
];

export function Navbar({ activeView, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (view: HospitalView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_12px_rgba(15,23,42,0.03)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6 lg:gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="font-display text-lg sm:text-[19px] font-bold tracking-tight text-[#0F4C81] hover:text-[#0A365C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Spine X Hospital
        </button>

        {/* Zone 2: Clean Single-Line Text Navigation */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-6 text-[13.5px] font-medium text-slate-600"
        >
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative whitespace-nowrap shrink-0 py-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#0F4C81] font-semibold'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#0F4C81]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile/Tablet Menu Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('book')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-[13px] font-semibold text-white bg-[#0F4C81] rounded-xl shadow-[0_2px_8px_rgba(15,76,129,0.22)] hover:bg-[#0A365C] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 hidden sm:inline" aria-hidden="true" />
            <span>Book Appointment</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden bg-white border-t border-slate-200/80 shadow-lg px-4 py-5"
          >
            <nav aria-label="Mobile Navigation" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[...PRIMARY_NAV_ITEMS, { id: 'book' as HospitalView, label: 'Book OPD' }].map(
                  (item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`text-left px-3.5 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                          isActive
                            ? 'bg-sky-50 text-[#0F4C81] font-semibold border border-sky-200'
                            : 'text-slate-700 bg-slate-50/70 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-[11px] font-medium text-slate-500 px-1 mb-2">
                  Hospital &amp; Administration
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MOBILE_EXTRA_ITEMS.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`text-left px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                          isActive
                            ? 'bg-sky-50 text-[#0F4C81] font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
