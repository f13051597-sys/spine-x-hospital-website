import {
  Award,
  Building2,
  CalendarCheck,
  Clock,
  Eye,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Department, Doctor } from '../types/hospital';

interface DoctorsSectionProps {
  doctors: Doctor[];
  departments: Department[];
  onSelectDoctor: (doctor: Doctor) => void;
}

function getDoctorMonogram(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function DoctorsSection({
  doctors,
  departments,
  onSelectDoctor,
}: DoctorsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [profileDoctor, setProfileDoctor] = useState<Doctor | null>(null);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Record<string, boolean>>({});

  const departmentMap = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  const filteredDoctors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return doctors.filter((doc) => {
      const matchesDept = departmentFilter === 'all' || doc.departmentId === departmentFilter;
      if (!matchesDept) return false;
      if (!term) return true;
      const deptName = departmentMap.get(doc.departmentId)?.name.toLowerCase() ?? '';
      return (
        doc.name.toLowerCase().includes(term) ||
        doc.specialty.toLowerCase().includes(term) ||
        (doc.qualification || '').toLowerCase().includes(term) ||
        deptName.includes(term)
      );
    });
  }, [doctors, departmentFilter, searchTerm, departmentMap]);

  const markPhotoFailed = (docId: string) => {
    setFailedPhotoIds((prev) => ({ ...prev, [docId]: true }));
  };

  return (
    <section className="py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-emerald-800">Medical Consultants</p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Our Doctors &amp; OPD Consultation Fees
            </h2>
            <p className="text-sm text-slate-600">
              Review verified specialist profiles, qualifications, and OPD consultation fees before
              reserving an appointment slot.
            </p>
          </div>

          {/* Search & Department Filter */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search doctor, specialty, qualification..."
                aria-label="Search doctor or specialty"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter doctors by department"
              className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#0F4C81]"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredDoctors.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <p className="text-base font-medium text-slate-900">
              No consultants match your current filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDepartmentFilter('all');
              }}
              className="px-4 py-2 text-sm font-medium text-[#0F4C81] border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doctor) => {
              const dept = departmentMap.get(doctor.departmentId);
              const monogram = getDoctorMonogram(doctor.name);
              const hasPhoto = Boolean(doctor.photoUrl) && !failedPhotoIds[doctor.id];

              return (
                <article
                  key={doctor.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-sky-300 transition-colors"
                >
                  <div>
                    {/* Consistent Real Doctor Portrait Frame */}
                    <div className="aspect-[5/4] w-full bg-slate-100 border-b border-slate-200 overflow-hidden relative">
                      {hasPhoto ? (
                        <img
                          src={doctor.photoUrl}
                          alt={`${doctor.name} — ${doctor.specialty || 'Consultant Doctor'}`}
                          onError={() => markPhotoFailed(doctor.id)}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-sky-50 to-slate-100 flex flex-col items-center justify-center gap-2 text-[#0F4C81]">
                          <div className="w-16 h-16 rounded-full bg-white border border-sky-200 flex items-center justify-center font-display text-xl font-bold">
                            {monogram}
                          </div>
                          <span className="text-xs text-slate-500">Photo Unavailable</span>
                        </div>
                      )}
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-medium ${
                              doctor.isAvailable ? 'text-emerald-800' : 'text-slate-500'
                            }`}
                          >
                            {doctor.isAvailable ? 'Available for OPD' : 'Currently Unavailable'}
                          </span>
                          {doctor.nmcNo && (
                            <span className="text-xs font-mono text-slate-500">
                              NMC #{doctor.nmcNo}
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-lg font-bold text-slate-950 leading-snug">
                          {doctor.name}
                        </h3>

                        {doctor.qualification && (
                          <p className="text-xs font-medium text-[#0F4C81] leading-relaxed">
                            {doctor.qualification}
                          </p>
                        )}

                        <p className="text-sm text-slate-700 leading-relaxed">
                          {doctor.specialty || 'OPD Consultant'}
                        </p>

                        {dept && (
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{dept.name}</span>
                          </p>
                        )}
                      </div>

                      <dl className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">OPD Fee</dt>
                          <dd className="font-mono tabular-nums font-semibold text-slate-950 mt-0.5">
                            {doctor.opdFee > 0 ? `NPR ${doctor.opdFee}` : 'Confirm at Desk'}
                          </dd>
                        </div>

                        {doctor.opdSchedule ? (
                          <div>
                            <dt className="text-xs text-slate-500">OPD Schedule</dt>
                            <dd className="text-xs font-medium text-emerald-800 mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{doctor.opdSchedule}</span>
                            </dd>
                          </div>
                        ) : (
                          <div>
                            <dt className="text-xs text-slate-500">Online Slots</dt>
                            <dd className="text-xs font-mono text-slate-700 mt-1">
                              {doctor.availableSlots.length} configurable slots
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  <div className="px-6 pb-6 flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={!doctor.isAvailable}
                      onClick={() => onSelectDoctor(doctor)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                      <span>{doctor.isAvailable ? 'Book OPD' : 'Unavailable'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfileDoctor(doctor)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      <span>Profile</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified Doctor Profile Modal */}
      {profileDoctor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-profile-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setProfileDoctor(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3
                id="doctor-profile-modal-title"
                className="font-display font-bold text-lg text-slate-950"
              >
                Consultant Profile
              </h3>
              <button
                type="button"
                onClick={() => setProfileDoctor(null)}
                aria-label="Close doctor profile"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="w-28 h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  {profileDoctor.photoUrl && !failedPhotoIds[profileDoctor.id] ? (
                    <img
                      src={profileDoctor.photoUrl}
                      alt={profileDoctor.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full bg-sky-50 text-[#0F4C81] font-display font-bold text-xl flex items-center justify-center">
                      {getDoctorMonogram(profileDoctor.name)}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-display text-xl font-bold text-slate-950">
                    {profileDoctor.name}
                  </h4>
                  <p className="text-sm text-slate-700">
                    {profileDoctor.specialty || 'OPD Consultant'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Department:{' '}
                    {departmentMap.get(profileDoctor.departmentId)?.name || 'General OPD'}
                  </p>
                  {profileDoctor.nmcNo && (
                    <p className="text-xs font-mono text-slate-600">
                      NMC Registration No.: {profileDoctor.nmcNo}
                    </p>
                  )}
                </div>
              </div>

              {profileDoctor.qualification && (
                <div className="p-4 rounded-lg bg-sky-50/70 border border-sky-200 space-y-1">
                  <div className="text-xs font-semibold text-[#0F4C81] flex items-center gap-1.5">
                    <Award className="w-4 h-4" aria-hidden="true" />
                    <span>Qualifications &amp; Training</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {profileDoctor.qualification}
                  </p>
                </div>
              )}

              {profileDoctor.clinicalFocus && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
                    <span>Clinical Areas</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {profileDoctor.clinicalFocus}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">OPD Consultation Fee</dt>
                  <dd className="font-mono tabular-nums font-bold text-[#0F4C81] mt-0.5">
                    {profileDoctor.opdFee > 0
                      ? `NPR ${profileDoctor.opdFee}`
                      : 'Confirm at OPD Desk'}
                  </dd>
                </div>
                {profileDoctor.opdSchedule && (
                  <div>
                    <dt className="text-xs text-slate-500">OPD Schedule</dt>
                    <dd className="font-medium text-emerald-800 mt-0.5">
                      {profileDoctor.opdSchedule}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProfileDoctor(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!profileDoctor.isAvailable}
                onClick={() => {
                  const chosen = profileDoctor;
                  setProfileDoctor(null);
                  onSelectDoctor(chosen);
                }}
                className="px-5 py-2 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-300 cursor-pointer"
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
