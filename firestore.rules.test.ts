// Security rules verification cases corresponding to security_spec.md Dirty Dozen
export const dirtyDozenCases = [
  { id: 1, name: 'Unauthenticated read on /appointments, /payments, or /refunds', collection: 'payments', op: 'list', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unauthenticated list on /appointmentStatus or /paymentPortals', collection: 'paymentPortals', op: 'list', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Public payment creation with verificationStatus=verified', collection: 'payments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow field injection on /payments or /refunds', collection: 'payments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Duplicate transaction ID lock overwrite in /paymentTxLocks', collection: 'paymentTxLocks', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Orphaned payment without /paymentTxLocks and /paymentPortals', collection: 'payments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Refund submission against unverified payment', collection: 'refunds', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Cross-patient refund submission with mismatched portalLookupId', collection: 'refunds', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Marking refund status=refunded without refundTxRef proof', collection: 'refunds', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Client-forged createdAt timestamp on /payments or /refunds', collection: 'payments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Oversized or invalid-character document ID poisoning', collection: 'appointments', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Non-admin or unverified email attempting payment verification or refund approval', collection: 'refunds', op: 'update', expected: 'PERMISSION_DENIED' },
];
