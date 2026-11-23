# Firestore Security Specification — Spine X Superspeciality Hospital

## 1. Data Invariants
1. **Patient PII Isolation**: An unauthenticated patient or non-admin user must NEVER be able to `get`, `list`, `update`, or `delete` any document in `/appointments/{appointmentId}`.
2. **Duplicate Slot Prevention**: No two active appointments may occupy the same `(doctorId, appointmentDate, timeSlot)` tuple; enforced atomically via deterministic `/bookedSlots/{slotLockId}` creation with `existsAfter` verification.
3. **Referential & Temporal Integrity**: Every `/appointments/{appointmentId}` creation must reference an existing or core-allowlisted `/doctors/{doctorId}` and `/departments/{departmentId}`, enforce `status == 'pending'`, enforce valid reminder enums, and validate `createdAt == request.time` and `updatedAt == request.time`.
4. **Verified Status Lookup Without Enumeration**: `/appointmentStatus/{lookupId}` disables `list` for non-admins and allows `get` only via a 64-char SHA-256 hash derived from `bookingId + mobileNumber`, exposing zero raw mobile numbers or full patient names.
5. **Feedback Integrity & Moderation**: `/feedback/{feedbackId}` validates rating bounds (`1..5`), comment length (`5..500`), server timestamp (`createdAt == request.time`), and restricts moderation (`isPublished` toggle and `delete`) exclusively to verified admins.
6. **Doctor & Department Integrity**: Only verified admins can create, edit (including bounded `photoUrl <= 150000` bytes), or delete `/doctors` and `/departments`.
7. **Admin RBAC**: Only verified admins (`f13051597@gmail.com` with `email_verified == true` or UIDs registered in `/admins/{uid}`) can read/manage appointments, feedback moderation, doctors, departments, and release cancelled/rejected slot locks.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **PII Read Leak**: Unauthenticated `get` or `list` on `/appointments`.
2. **Status Enumeration**: Unauthenticated `list` on `/appointmentStatus`.
3. **Pre-Approved Injection**: Public `create` on `/appointments` with `status: "approved"`.
4. **Shadow Field Injection**: Public `create` on `/appointments` or `/feedback` with extra ghost key `isAdminOverride: true`.
5. **Orphaned Appointment (No Slot Lock)**: Public `create` on `/appointments` without atomically creating `/bookedSlots/{slotLockId}`.
6. **Orphaned Slot Lock (No Appointment)**: Public `create` on `/bookedSlots/{slotLockId}` without atomically creating `/appointments/{appointmentId}`.
7. **Duplicate Slot Overwrite**: Public `create` or `update` on an already-existing `/bookedSlots/{slotLockId}`.
8. **Fake Doctor Reference**: Public `create` on `/appointments` referencing a nonexistent `doctorId`.
9. **Client Timestamp Forgery**: Public `create` on `/appointments` or `/feedback` with a client-supplied past timestamp instead of `request.time`.
10. **ID Poisoning**: Document `create` with a 1500-char or invalid-character `appointmentId` or `feedbackId`.
11. **Unauthenticated Admin Write / Moderation**: Non-admin write to `/doctors/{doctorId}`, `/departments/{departmentId}`, or `update`/`delete` on `/feedback/{feedbackId}`.
12. **Email Spoofing**: Authenticated user with unverified email (`email_verified == false`) attempting admin read/write.
