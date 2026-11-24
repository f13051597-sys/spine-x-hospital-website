import { ArrowRight, Baby, Bone, HeartPulse, Scissors, Stethoscope } from 'lucide-react';
import type { Department } from '../types/hospital';

interface DepartmentsSectionProps {
  departments: Department[];
  onBookDepartment: (departmentId: string) => void;
  compact?: boolean;
}

function getDepartmentIcon(id: string) {
  if (id.includes('ortho')) return Bone;
  if (id.includes('gyne')) return HeartPulse;
  if (id.includes('neonatal') || id.includes('pediatric')) return Baby;
  if (id.includes('surg')) return Scissors;
  return Stethoscope;
}

export function DepartmentsSection({
  departments,
  onBookDepartment,
  compact = false,
}: DepartmentsSectionProps) {
  return (
    <section className="py-16 lg:py-22 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-emerald-800">Departmental Services</p>
            <h2
              className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-slate-950"
              style={{ textWrap: 'balance' }}
            >
              Specialized Clinical Departments
            </h2>
          </div>
          {!compact && (
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Select a clinical department below to schedule an outpatient consultation or review
              available specialist care.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept, index) => {
            const Icon = getDepartmentIcon(dept.id);
            return (
              <article
                key={dept.id}
                className="surface-card surface-card-hover rounded-2xl p-6 flex flex-col justify-between space-y-5 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 text-[#0F4C81] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#0F4C81]">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                    </div>
                    <span className="text-right">
                      {dept.is24x7 ? 'OPD & Surgical/Inpatient' : 'Specialist OPD'} ·{' '}
                      <span className={dept.isActive ? 'text-emerald-800 font-medium' : ''}>
                        {dept.isActive ? 'Operational' : 'Paused'}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-950 leading-snug">
                      {dept.name}
                    </h3>
                    {dept.nepaliName && (
                      <p className="text-xs font-medium text-[#0F4C81] mt-1">{dept.nepaliName}</p>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">{dept.summary}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3.5">
                  <p className="text-xs text-slate-500 leading-relaxed">{dept.careScope}</p>

                  <button
                    type="button"
                    onClick={() => onBookDepartment(dept.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F4C81] hover:text-[#0A365C] cursor-pointer"
                  >
                    <span>Book OPD Appointment</span>
                    <ArrowRight
                      className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
