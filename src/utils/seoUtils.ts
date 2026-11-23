import type { HospitalView } from '../types/hospital';

interface ViewSeoConfig {
  title: string;
  description: string;
}

const VIEW_SEO: Record<HospitalView, ViewSeoConfig> = {
  home: {
    title: 'Spine X Superspeciality Hospital | Birtamode, Jhapa',
    description:
      'Book online OPD appointments, check booking status, and access 24-hour emergency, trauma, spine, and ICU care at Spine X Hospital in Birtamode, Jhapa.',
  },
  departments: {
    title: 'Clinical Departments | Spine X Hospital Birtamode',
    description:
      'Explore Orthopedics, Neurology & Spine, Gynecology & Obstetrics, Neonatal & Pediatrics, Internal Medicine, and Surgical Services at Spine X Hospital.',
  },
  doctors: {
    title: 'Doctors Directory & OPD Fees | Spine X Hospital',
    description:
      'View verified consultant doctors, qualifications, NMC numbers, OPD schedules, and consultation fees at Spine X Superspeciality Hospital, Birtamode.',
  },
  book: {
    title: 'Book Online OPD Appointment | Spine X Hospital',
    description:
      'Reserve a confirmed OPD slot with specialist doctors at Spine X Superspeciality Hospital & Trauma Center, Bhagwan Chowk, Birtamode-3, Jhapa.',
  },
  status: {
    title: 'Check Appointment Status | Spine X Hospital',
    description:
      'Verify your Spine X Hospital OPD appointment status and download calendar reminders using your Booking ID and registered mobile number.',
  },
  about: {
    title: 'About Spine X Superspeciality Hospital | Birtamode',
    description:
      'Learn about Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd. in Birtamode, Jhapa—24/7 emergency, ICU/NICU/PICU, diagnostics, and specialist care.',
  },
  contact: {
    title: 'Contact & Emergency Desk (9807923351) | Spine X Hospital',
    description:
      'Contact Spine X Hospital in Bhagwan Chowk, Birtamode-3, Jhapa. Call 9807923351 or 023-591068 for 24-hour emergency, ambulance, and OPD support.',
  },
  faq: {
    title: 'Frequently Asked Questions | Spine X Hospital',
    description:
      'Answers on online OPD booking, appointment reminders, 24-hour emergency care, and patient data privacy at Spine X Hospital, Birtamode.',
  },
  privacy: {
    title: 'Patient Privacy Policy | Spine X Hospital Birtamode',
    description:
      'Read how Spine X Superspeciality Hospital protects patient appointment confidentiality, booking lookup privacy, and clinical records.',
  },
  admin: {
    title: 'Hospital Admin Console | Spine X Hospital',
    description:
      'Authorized administrator console for Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd.',
  },
};

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function applyViewSeoMetadata(view: HospitalView) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const cfg = VIEW_SEO[view] || VIEW_SEO.home;
  const canonicalUrl = `${window.location.origin}${window.location.pathname}${
    view === 'home' ? '' : `#${view}`
  }`;

  document.title = cfg.title;
  upsertMetaTag('name', 'description', cfg.description);
  upsertMetaTag('property', 'og:title', cfg.title);
  upsertMetaTag('property', 'og:description', cfg.description);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('name', 'twitter:title', cfg.title);
  upsertMetaTag('name', 'twitter:description', cfg.description);
  upsertCanonical(canonicalUrl);
}
