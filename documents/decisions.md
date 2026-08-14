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

## Decision 3: Deactivated User Session Validation & Session Utility Extraction

### Problem Discovered
1. **Deactivated Account Bypass Bug**: `createContext()` in `trpc.ts` fetched sessions without verifying `user.active`. Deactivated users holding active session cookies could still authenticate for protected tRPC procedures.
2. **Duplicated Session Creation**: Session token generation and cookie setting was embedded inline inside `auth.ts` `login` mutation.

### Solution
- Updated `createContext()` in `trpc.ts` to require `row.user.active === true`.
- Extracted session creation into a reusable `createSession(db, userId)` helper in `auth.ts` enforcing security flags (`httpOnly`, `sameSite: "lax"`, `secure`).
- Updated `register` mutation to issue a session token automatically.

### Justification
Ensures immediate account revocation upon deactivation and standardizes session handling across authentication workflows.

## Decision 4: Membership Subscription Management & Payment Refund Safety

### Problem Discovered
1. **In-Memory Filtering**: `plans.ts` fetched all membership plans and filtered inactive items in JS.
2. **Membership Stacking Bug**: Subscribing to a new plan created a new `active` membership without expiring previous active plans.
3. **Refund Orphan Bookings**: Refunding a payment cancelled the membership but left future class bookings active.
4. **Date Helper Duplication**: `addDays()` helper was defined inline in `plans.ts`.

### Solution
- Added `.where(eq(membershipPlans.active, true))` SQL filter in `plans.list`.
- Updated `subscribe` in `plans.ts` to set previous active memberships to `"expired"`.
- Updated `refund` in `payments.ts` to cancel future confirmed bookings linked to the refunded membership.
- Extracted `addDays()` to `src/lib/booking-utils.ts`.

### Justification
Prevents orphaned active memberships, secures credit refund integrity, and optimizes SQL queries.

## Decision 5: Unified Utilization Analytics & Middleware-Based Trainer Authorization

### Problem Discovered
1. **Utilization Analytics Defect**: `admin.ts` `classUtilisation` query calculated booked class counts by querying only `bookings`, underreporting utilization for classes attended by corporate members.
2. **Duplicated Role Checks**: `trainers.ts` duplicated `if (ctx.user.role !== "trainer")` checks across all procedure handlers.
3. **Manual Query Stitching**: `noShowList` fired a secondary SQL query and used in-memory JavaScript Maps to attach trainer names to no-show records.

### Solution
- Updated `classUtilisation` SQL query in `admin.ts` to sum confirmed spots across both `bookings` and `corporateBookings`.
- Added `trainerProcedure` in `trpc.ts` to enforce trainer authorization at the middleware level.
- Refactored `noShowList` to join trainer user details directly in SQL.

### Justification
Provides 100% accurate utilization reporting, cleans up repetitive authorization boilerplate, and eliminates multi-step SQL queries.

## Decision 6: Class Schedule Capacity & Cancellation Cascade

### Problem Discovered
1. **False Schedule Capacity**: `classes.list` calculated `spotsLeft` and `full` by counting only `bookings`, causing the Schedule page (`/schedule`) to report full classes as empty if booked by corporate members.
2. **Orphan Corporate Class Cancellation**: When an admin cancelled a class (`classes.cancel`), it cancelled `bookings` rows but left `corporateBookings` rows active.

### Solution
- Updated `classes.list` subquery to sum confirmed bookings across both `bookings` and `corporateBookings` tables.
- Updated `classes.cancel` to cancel active bookings in both `bookings` and `corporateBookings` tables.

### Justification
Ensures accurate Schedule UI capacity indicators and complete booking cancellation cascades across all channel types.

## Decision 7: Broadcast Target Filtering & Input Validation

### Problem Discovered
1. **Deactivated Notification Broadcast**: `notifications.ts` broadcast announcements to all users with `role = "member"`, including deactivated accounts.
2. **Empty Search Wildcard Match**: `members.ts` `lookupByEmailOrPhone` executed wildcard `%` searches when provided an empty query, returning arbitrary first-row matches.

### Solution
- Updated `notifications.ts` `broadcast` query to require `and(eq(users.role, "member"), eq(users.active, true))`.
- Added input trimming and non-empty string validation to `lookupByEmailOrPhone`.

### Justification
Prevents database pollution on inactive accounts and guarantees predictable search behavior.

## Decision 8: Navigation Accessibility & Reschedule Modal UI Polish

### Problem Discovered
1. **Missing Plans Link**: Logged-in users had no header link to access the membership plans page (`/plans`).
2. **Reschedule Self-Selection**: `RescheduleModal` listed the member's current class session among available target reschedule slots.

### Solution
- Added `/plans` link to `NavBar.tsx` for logged-in members.
- Added current class slot filtering (`cls.startsAt !== fromClassTime`) to `RescheduleModal`.

### Justification
Improves user navigation and prevents redundant reschedule submission errors in the UI.

## Decision 9: Fix Infinite Re-fetch Loop on Schedule Page

### Problem Discovered
- `/schedule` page passed `from: new Date().toISOString()` inline to `useQuery`. This evaluated a new timestamp string on every component render, causing React Query to continuously invalidate the cache key and trigger an infinite HTTP fetch loop.

### Solution
- Stabilized `from` query parameter using `useState(() => new Date().toISOString())`.

### Justification
Eliminates server request spam and restores responsive schedule page rendering.







