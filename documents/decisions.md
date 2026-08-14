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
