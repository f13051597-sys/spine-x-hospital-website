import { Menu, X } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="font-display text-lg font-bold tracking-tight text-[#0F4C81] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0F4C81]"
        >
          Spine X Hospital
        </button>

        {/* Zone 2: Single-line text nav links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600"
        >
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#0F4C81] border-[#0F4C81]'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile/Tablet Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('book')}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Book Appointment
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4">
          <nav aria-label="Mobile Navigation" className="grid grid-cols-2 gap-2">
            {[
              ...PRIMARY_NAV_ITEMS,
              { id: 'book' as HospitalView, label: 'Book OPD' },
              ...MOBILE_EXTRA_ITEMS,
            ].map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-sky-50 text-[#0F4C81]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
