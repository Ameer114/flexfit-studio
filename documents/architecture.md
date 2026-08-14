# FlexFit Studio — Architecture & Technical Specifications

## 1. Overview & System Philosophy

FlexFit Studio is a multi-tenant gym management platform handling member subscriptions, corporate credit pools, class scheduling, waitlists, front-desk attendance, and revenue analytics.

### Core Architectural Goals:
- **Exact Behavioral Preservation**: All API inputs, outputs, error messages, and edge cases are preserved without breaking existing frontend contracts.
- **Single Source of Truth**: Business rules, cancellation windows, credit logic, and date math are consolidated into shared domain utilities (`src/lib/booking-utils.ts`).
- **Defensible Domain Boundaries**: Credit accounting remains distinct between personal memberships and corporate pools, while class capacity and attendance logic are fully unified.

---

## 2. Directory Structure & Domain Layers

```
src/
├── app/                      # Next.js App Router (UI Pages & Layouts)
├── db/                       # Database Schema & Drizzle Client
│   ├── schema.ts             # SQLite Schema Definitions
│   ├── seed.ts               # Database Seed Data
│   └── index.ts              # Drizzle ORM Instance Initialization
├── lib/                      # Core Domain Utilities & Business Logic
│   ├── booking-utils.ts      # Shared Booking, Capacity, Waitlist & Policy Utilities
│   ├── password.ts           # Password Hashing & Verification
│   └── trpc.ts               # React Query / tRPC Client Hooks
└── server/                   # Backend RPC API Layer
    ├── trpc.ts               # tRPC Context & Middleware Pipeline
    └── routers/              # Domain Routers
        ├── _app.ts           # Root tRPC Router Assembly
        ├── admin.ts          # Studio Analytics & Revenue Reports
        ├── admin-companies.ts# Corporate Account Management
        ├── auth.ts           # Authentication & Session Handlers
        ├── bookings.ts       # Member Class Reservations & Waitlists
        ├── classes.ts        # Class Schedule Management
        ├── corporate-bookings.ts # Corporate Pool Class Reservations
        ├── members.ts        # Member Profiles & Directory
        ├── notifications.ts  # Member Notifications
        ├── payments.ts       # Payment Transactions & Refunds
        ├── plans.ts          # Membership Plans & Subscriptions
        ├── reschedules.ts    # Class Rescheduling Logic
        └── trainers.ts       # Trainer Availability & Schedules
```

---

## 3. Key Architecture & Business Domain Solutions

### A. Shared Domain Utility Layer (`src/lib/booking-utils.ts`)
Common functions previously duplicated across multiple routers were extracted into a centralized module:
- `hoursUntil(iso, now)`: Date/time differential calculation for cancellation & reschedule rules.
- `activeMembershipFor(db, userId)`: Active, unexpired membership resolution.
- `addDays(dateIso, days)`: Standardized ISO date arithmetic.
- `getTotalBookedCountForClass(db, classId)`: Cross-table capacity calculation summing `bookings` and `corporateBookings`.
- `isRefundableCancellation(...)` & `isRescheduleAllowed(...)`: Centralized policy checkers.
- `getWaitlistQueuePosition(db, classId, bookedAt)`: Dynamic FIFO waitlist position calculator.

### B. Middleware Pipeline (`src/server/trpc.ts`)
Authentication and role-based access control are enforced cleanly via tRPC procedure middleware:
- `publicProcedure`: Unauthenticated public endpoints.
- `protectedProcedure`: Requires a valid session token **and an active user account** (`row.user.active === true`).
- `staffProcedure`: Restricted to `admin` or `trainer` roles.
- `trainerProcedure`: Dedicated middleware restricted to `trainer` role.
- `adminProcedure`: Restricted to `admin` role.

### C. Data Integrity & Business Rule Fixes

1. **Cross-Table Capacity Synchronization**:
   - `getTotalBookedCountForClass()` queries both standard `bookings` and `corporateBookings` tables to ensure total class capacity (`capacity`) is strictly respected regardless of booking channel.

2. **Session Account Revocation**:
   - `createContext()` in `trpc.ts` verifies `user.active === true`. Deactivating a user account immediately invalidates all active session tokens.

3. **Subscription Stacking Prevention**:
   - Subscribing to a new membership plan in `plans.ts` automatically updates previous active memberships for that user to `"expired"`.

4. **Payment Refund Cascade Safety**:
   - Refunding a payment in `payments.ts` cancels the associated membership **and** automatically cancels all future confirmed class bookings tied to that membership.

5. **SQL Query & Analytics Optimization**:
   - Replaced in-memory JS array filtering with `.where(eq(..., true))` SQL queries in `plans.ts`.
   - Refactored `noShowList` in `admin.ts` to use SQL `leftJoin(alias(users, "trainerUser"))` instead of multi-step JS Map queries.

---

## 4. Defensible Trade-offs

- **Separate Booking Schema (`bookings` vs `corporateBookings`)**: Retained separate tables for standard member bookings and corporate pool bookings to preserve existing database schema compatibility while unifying capacity calculation at the application service level.
- **Dynamic FIFO Waitlist Computation**: Computed waitlist positions live via `sql<number>count(*)` rather than storing volatile rank integers in the database, avoiding race conditions during cancellations and promotions.