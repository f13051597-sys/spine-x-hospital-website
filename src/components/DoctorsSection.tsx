import { CalendarCheck, Search } from 'lucide-react';
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
        deptName.includes(term)
      );
    });
  }, [doctors, departmentFilter, searchTerm, departmentMap]);

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
              Doctor Directory &amp; OPD Consultation Fees
            </h2>
            <p className="text-sm text-slate-600">
              Select a consultant below to view OPD fees and reserve an open appointment slot.
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
                placeholder="Search doctor or specialty..."
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDoctors.map((doctor) => {
              const dept = departmentMap.get(doctor.departmentId);
              const monogram = getDoctorMonogram(doctor.name);

              return (
                <article
                  key={doctor.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6 hover:border-sky-300 transition-colors"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div
                        aria-hidden="true"
                        className="w-12 h-12 rounded-lg bg-sky-50 border border-sky-200 text-[#0F4C81] font-display font-bold text-sm flex items-center justify-center shrink-0"
                      >
                        {monogram}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-display text-lg font-semibold text-slate-950 leading-snug">
                          {doctor.name}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {doctor.specialty ? doctor.specialty : 'OPD Consultant'}
                          {dept ? ` · ${dept.name}` : ''}
                        </p>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">OPD Fee</dt>
                        <dd className="font-mono tabular-nums font-semibold text-slate-950 mt-0.5">
                          NPR {doctor.opdFee}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Booking Status</dt>
                        <dd
                          className={`text-xs font-medium mt-1 ${
                            doctor.isAvailable ? 'text-emerald-800' : 'text-slate-500'
                          }`}
                        >
                          {doctor.isAvailable ? 'Available for OPD' : 'Unavailable'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    disabled={!doctor.isAvailable}
                    onClick={() => onSelectDoctor(doctor)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C81] text-white text-sm font-medium hover:bg-[#0B3A63] disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {doctor.isAvailable ? 'Book Appointment' : 'Currently Unavailable'}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
