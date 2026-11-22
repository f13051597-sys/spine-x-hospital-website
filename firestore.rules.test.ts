// Security rules verification cases corresponding to security_spec.md Dirty Dozen
export const dirtyDozenCases = [
  { id: 1, name: 'Unauthenticated read on /appointments', collection: 'appointments', op: 'list', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unauthenticated list on /appointmentStatus', collection: 'appointmentStatus', op: 'list', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Public appointment creation with status=approved', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow field injection on /appointments', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Orphaned appointment without /bookedSlots atomic lock', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Orphaned slot lock without /appointments creation', collection: 'bookedSlots', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Duplicate bookedSlot overwrite attempt', collection: 'bookedSlots', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Appointment referencing nonexistent doctorId', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Client-forged createdAt timestamp', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Oversized or invalid-character document ID poisoning', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Non-admin write to /doctors or /departments', collection: 'doctors', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Unverified email spoofing admin account', collection: 'appointments', op: 'get', expected: 'PERMISSION_DENIED' },
];
