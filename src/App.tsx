import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { BookingSection } from './components/BookingSection';
import { DepartmentsSection } from './components/DepartmentsSection';
import { DoctorsSection } from './components/DoctorsSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { HealthSearchSection } from './components/HealthSearchSection';
import { HeroSection } from './components/HeroSection';
import { HospitalChatbot } from './components/HospitalChatbot';
import {
  AboutPage,
  ContactPage,
  FaqSection,
  PrivacyPolicyPage,
} from './components/InfoPages';
import { LocationSection } from './components/LocationSection';
import { Navbar } from './components/Navbar';
import { ServicesShowcase } from './components/ServicesShowcase';
import { StatusLookupSection } from './components/StatusLookupSection';
import { INITIAL_DEPARTMENTS, INITIAL_DOCTORS } from './data/hospitalCatalog';
import { fetchPublicCatalog } from './services/hospitalService';
import type { Department, Doctor, HospitalView } from './types/hospital';

function parseViewFromHash(): HospitalView {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  const valid: HospitalView[] = [
    'home',
    'departments',
    'doctors',
    'book',
    'status',
    'about',
    'contact',
    'faq',
    'privacy',
    'admin',
  ];
  return valid.includes(hash as HospitalView) ? (hash as HospitalView) : 'home';
}

export default function App() {
  const [activeView, setActiveView] = useState<HospitalView>(() => parseViewFromHash());
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [preselectedDoctorId, setPreselectedDoctorId] = useState<string | undefined>();
  const [preselectedDepartmentId, setPreselectedDepartmentId] = useState<string | undefined>();
  const [statusPrefill, setStatusPrefill] = useState<{ bookingId: string; mobile: string }>({
    bookingId: '',
    mobile: '',
  });

  const loadCatalog = useCallback(async () => {
    const includeInactive = activeView === 'admin';
    const data = await fetchPublicCatalog(includeInactive);
    setDepartments(data.departments);
    setDoctors(data.doctors);
  }, [activeView]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const onHashChange = () => setActiveView(parseViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((view: HospitalView) => {
    setActiveView(view);
    window.location.hash = view === 'home' ? '' : view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBookDepartment = (departmentId: string) => {
    setPreselectedDepartmentId(departmentId);
    setPreselectedDoctorId(undefined);
    navigate('book');
  };

  const handleSelectDoctor = (doctor: Doctor) => {
    setPreselectedDoctorId(doctor.id);
    setPreselectedDepartmentId(doctor.departmentId);
    navigate('book');
  };

  const handleGoToStatusCheck = (bookingId: string, mobile: string) => {
    setStatusPrefill({ bookingId, mobile });
    navigate('status');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar activeView={activeView} onNavigate={navigate} />

        <main className="flex-1">
          {activeView === 'home' && (
            <>
              <HeroSection
                departmentCount={departments.length}
                doctorCount={doctors.length}
                onBookNow={() => navigate('book')}
                onCheckStatus={() => navigate('status')}
              />
              <DepartmentsSection
                departments={departments}
                onBookDepartment={handleBookDepartment}
              />
              <ServicesShowcase onBookNow={() => navigate('book')} />
              <DoctorsSection
                doctors={doctors}
                departments={departments}
                onSelectDoctor={handleSelectDoctor}
              />
              <BookingSection
                departments={departments}
                doctors={doctors}
                preselectedDoctorId={preselectedDoctorId}
                preselectedDepartmentId={preselectedDepartmentId}
                onGoToStatusCheck={handleGoToStatusCheck}
              />
              <StatusLookupSection
                initialBookingId={statusPrefill.bookingId}
                initialMobile={statusPrefill.mobile}
              />
              <LocationSection />
              <HealthSearchSection />
              <FaqSection />
            </>
          )}

          {activeView === 'departments' && (
            <DepartmentsSection
              departments={departments}
              onBookDepartment={handleBookDepartment}
            />
          )}

          {activeView === 'doctors' && (
            <DoctorsSection
              doctors={doctors}
              departments={departments}
              onSelectDoctor={handleSelectDoctor}
            />
          )}

          {activeView === 'book' && (
            <BookingSection
              departments={departments}
              doctors={doctors}
              preselectedDoctorId={preselectedDoctorId}
              preselectedDepartmentId={preselectedDepartmentId}
              onGoToStatusCheck={handleGoToStatusCheck}
            />
          )}

          {activeView === 'status' && (
            <StatusLookupSection
              initialBookingId={statusPrefill.bookingId}
              initialMobile={statusPrefill.mobile}
            />
          )}

          {activeView === 'about' && <AboutPage onBookNow={() => navigate('book')} />}

          {activeView === 'contact' && <ContactPage onBookNow={() => navigate('book')} />}

          {activeView === 'faq' && (
            <>
              <HealthSearchSection />
              <FaqSection />
            </>
          )}

          {activeView === 'privacy' && <PrivacyPolicyPage />}

          {activeView === 'admin' && (
            <AdminDashboard
              departments={departments}
              doctors={doctors}
              onCatalogUpdated={loadCatalog}
            />
          )}
        </main>

        <HospitalChatbot
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onBookNow={() => navigate('book')}
        />

        <Footer
          onNavigate={navigate}
          onToggleChat={() => setIsChatOpen((prev) => !prev)}
          isChatOpen={isChatOpen}
        />
      </div>
    </ErrorBoundary>
  );
}
