## Decision 1: Shared Booking Utilities & Combined Capacity Calculation

### Problem Discovered
1. **Helper Duplication**: `hoursUntil()` and `activeMembershipFor()` were duplicated across `bookings.ts`, `corporate-bookings.ts`, and `reschedules.ts`.
2. **Class Overbooking Bug**: `bookings.ts` checked class capacity by counting only regular member bookings. `corporate-bookings.ts` checked capacity by counting only corporate bookings. Because they ignored each other, a class with capacity 10 could be booked by 10 members + 10 corporate employees (total 20).

### Solution
- Extracted shared utility functions into `src/lib/booking-utils.ts`.
- Implemented `getTotalBookedCountForClass(db, classId)` to sum confirmed bookings across **both** `bookings` and `corporateBookings` tables.
- Updated `bookings.ts`, `corporate-bookings.ts`, and `reschedules.ts` to use `getTotalBookedCountForClass()`.

### Justification
Preserves strict class capacity limits while removing duplicated helper code across the booking domain.


4. **Centralized Policy Constants & Rule Helpers**: 
   - Moved `FREE_CANCELLATION_HOURS`, `CORPORATE_FREE_CANCELLATION_HOURS`, `FREE_RESCHEDULE_HOURS`, and `UNLIMITED_CREDITS` into `src/lib/booking-utils.ts`.
   - Created reusable rule checkers `isRefundableCancellation()` and `isRescheduleAllowed()` to eliminate scattered condition logic.


## Decision 2: Waitlist Queue Helper & Corporate Check-in Fix

### Problem Discovered
1. **N+1 Query in Waitlisted Procedure**: `bookings.ts` fired individual SQL `count(*)` queries per waitlisted item in a `Promise.all` loop to calculate queue positions.
2. **Omitted Check-in Source Bug**: `corporate-bookings.ts` accepted a check-in `source` (`kiosk`, `app`, `front_desk`) in `markAttended`, but failed to pass `source: input.source` into the `checkins` database insertion.

### Solution
- Extracted `getWaitlistQueuePosition(db, classId, bookedAt)` into `src/lib/booking-utils.ts` for clean queue position calculation.
- Fixed `corporate-bookings.ts` `markAttended` procedure to correctly record `source: input.source`.

### Justification
Improves query readability/maintainability and ensures corporate attendance logging accurately captures check-in channels.
