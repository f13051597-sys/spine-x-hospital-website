# Firestore Security Specification — Spine X Superspeciality Hospital

## 1. Data Invariants
1. **Patient PII & Payment Isolation**: An unauthenticated user or another patient must NEVER be able to `get`, `list`, `update`, or `delete` another patient's `/appointments`, `/payments`, or `/refunds`. Signed-in patients may query/read ONLY documents where `resource.data.ownerUid == request.auth.uid`.
2. **Duplicate Slot & Duplicate Transaction Prevention**:
   - No two active appointments may occupy the same `(doctorId, appointmentDate, timeSlot)` tuple; enforced atomically via `/bookedSlots/{slotLockId}`.
   - No two payments (General or Appointment) may reuse the same normalized Fonepay Transaction ID; enforced atomically via `/paymentTxLocks/{sha256(txId)}`.
3. **Zero Fake Payment Verification**: Every `/payments` creation (and optional `/appointments` payment status) MUST begin with `verificationStatus == 'pending_verification'`, `verificationMode == 'manual_pending'`, and `verifiedBy == ''`. Uploading a screenshot or entering a Transaction ID alone can NEVER mark a payment `verified`. Only verified admins (either manually or after receiving an authentic `/api/payments/fonepay/verify` confirmation) may transition a payment to `verified` or `rejected` and auto-approve its linked appointment.
4. **Verified Patient Portal Without Enumeration**: `/appointmentStatus/{lookupId}`, `/paymentPortals/{portalLookupId}`, and `/refundPortals/{portalLookupId}` disable `list` for non-admins and allow `get` only via a 64-char SHA-256 hash derived from `(Reference ID + Registered Mobile Number)`.
5. **Strict Refund Integrity & Return Confirmation**:
   - A `/refunds` document may ONLY be created if the referenced `/payments/{paymentId}` exists and already has `verificationStatus == 'verified'`.
   - Duplicate refund requests on the same payment are blocked via `/refundLocks/{paymentId}`.
   - Only verified admins may approve, reject, or refund a request. Transitioning a refund to `status == 'refunded'` strictly requires a non-empty `refundTxRef` (`size() >= 3`) and server timestamp `refundedAt == request.time`.
6. **Feedback, Doctors & Admin RBAC**: Preserves strict RBAC (`f13051597@gmail.com` with `email_verified == true` or UIDs in `/admins/{uid}`), bounded sizes, and server-side timestamps (`request.time`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **PII Read Leak**: Unauthenticated `get` or `list` on `/appointments`, `/payments`, or `/refunds`.
2. **Status / Payment Enumeration**: Unauthenticated `list` on `/appointmentStatus`, `/paymentPortals`, `/paymentTxLocks`, or `/refundPortals`.
3. **Self-Verified Payment Forgery**: Public `create` on `/payments` with `verificationStatus: "verified"` or `/appointments` with `paymentStatus: "verified"`.
4. **Shadow Field Injection**: Public `create` on `/appointments`, `/payments`, `/refunds`, or `/feedback` with extra ghost key `isAdminOverride: true`.
5. **Duplicate Transaction Replay**: Public `create` on `/payments` attempting to overwrite or reuse an existing `/paymentTxLocks/{txLockId}`.
6. **Orphaned Appointment or Payment Lock**: Public `create` on `/payments` without atomically creating `/paymentTxLocks/{txLockId}` and `/paymentPortals/{portalLookupId}`.
7. **Unverified Payment Refund**: Public `create` on `/refunds` referencing a `paymentId` whose `verificationStatus != 'verified'`.
8. **Cross-Patient Refund Spoofing**: Unauthenticated user creating `/refunds` using a mismatched `portalLookupId` or `ownerUid`.
9. **Refunded Without Transaction Proof**: Admin or non-admin setting `/refunds` `status: "refunded"` with empty `refundTxRef: ""`.
10. **Client Timestamp Forgery**: Public `create` on `/appointments`, `/payments`, `/refunds`, or `/feedback` with a past timestamp instead of `request.time`.
11. **ID Poisoning**: Document `create` with a 1500-char or invalid-character document ID.
12. **Unauthenticated Admin Write / Email Spoofing**: Non-admin or unverified-email user attempting to verify payments, approve appointments, edit doctors/departments, or process refunds.
