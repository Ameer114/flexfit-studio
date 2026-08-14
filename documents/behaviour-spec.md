# FlexFit Studio — Behavioral Audit & Domain Specification

This document records the exact behavior, domain rules, and edge cases discovered during initial code investigation. These specifications must be preserved across all refactoring.

---

## 1. Core Domain Rules

### Memberships & Credits
- **Unlimited Credit Threshold**: Membership plans with `creditsRemaining >= 999` are treated as unlimited. Their credit balance is never decremented during booking or rescheduling.
- **Active Membership Requirement**: A member can only book or reschedule classes if they possess an active membership (`status = 'active'` and `endDate >= today`).

### Cancellation Policies
- **Individual Member Cancellation**: Members can cancel free of charge up to **12 hours** before the class start time (`FREE_CANCELLATION_HOURS = 12`).
  - Cancelling $\ge 12\text{ hours}$ before start refunds the spent class credit back to the membership.
  - Cancelling $< 12\text{ hours}$ releases the spot but forfeits the credit (`creditsUsed` is lost).
- **Corporate Cancellation**: Corporate bookings require a **24-hour** cancellation window for credit refunds (`CORPORATE_FREE_CANCELLATION_HOURS = 24`). Refunded credits return directly to `companies.creditPoolBalance`.

### Rescheduling Policy
- **4-Hour Reschedule Window**: Members can reschedule a booking up to **4 hours** before class start (`FREE_RESCHEDULE_HOURS = 4`).
- **Same Class Restriction**: A booking can only be rescheduled to another session of the **exact same class name**.
- **Credit Continuity**: Rescheduling re-uses the original `creditsUsed` value without charging extra credits.

### Corporate Account Accounting
- **Shared Pool Model**: Corporate accounts buy a shared credit balance (`companies.creditPoolBalance`). Linked employees (`companyMembers`) book classes against this shared pool rather than individual memberships.

---

## 2. Booking & Waitlist Workflows

### Booking Procedure (`book`)
1. **Validation**: Target class must exist, not be cancelled, and not have already started.
2. **Duplicate Prevention**: Rejects if user is already `booked` or `waitlisted` for that class.
3. **Membership Check**: Requires an active membership.
4. **Credit Verification**: Requires `creditsRemaining >= class.creditCost` (unless unlimited plan $\ge 999$).
5. **Capacity & Waitlisting**:
   - Compares total confirmed spots against class capacity.
   - If full: status is set to `"waitlisted"` with `creditsUsed = 0` (joining waitlist is free).
   - If available: status is set to `"booked"`, `creditsUsed = class.creditCost`, and membership credits are decremented.

### Cancellation Procedure (`cancel`)
1. **Authorization**: Only the booking owner or staff (`admin` / `trainer`) can cancel.
2. **Refund Logic**: Refund occurs if cancelled $\ge 12\text{ hours}$ before start AND `creditsUsed > 0` (waitlist cancellations never trigger refunds since 0 credits were charged).
3. **Waitlist Auto-Promotion**:
   - When a confirmed (`booked`) spot is cancelled, the oldest waitlisted booking (`orderBy asc(bookedAt)`) is automatically promoted to `"booked"`.
   - The promoted member's active membership is charged the class credit cost.

### Attendance Check-in (`markAttended`)
- Staff procedure (front desk / kiosk / app).
- Only confirmed (`booked`) spots can be checked in.
- Flips status to `"attended"` and records a row in the `checkins` audit table.

---

## 3. Discovered Edge Cases & Audit Notes

- **Schedule Navigation**: Verify navigation links to `/schedule` render active schedules correctly.
- **Waitlist FIFO Order**: Auto-promotion relies strictly on `bookedAt` ascending timestamp order (First-Come-First-Served).
- **Waitlist Queue Position**: Queue positions are computed dynamically based on how many members joined the waitlist for that class at an earlier timestamp (`bookedAt < myBookedAt`).