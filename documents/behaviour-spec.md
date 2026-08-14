1. Schedule nav option is broken

2.I can see there's a special case: plans with 999 credits are treated as "unlimited" and never decrement — that's a real business rule I found in the code

3. there's a real rule here too: cancel more than 12 hours before class start = free (credit refunded); cancel later and you keep the spot open but forfeit the credit. That's the kind of exact rule

4. A company buys a credit pool (one shared balance, companies.creditPoolBalance) rather than individual memberships. Its employees (companyMembers) book classes against that shared pool via corporateBookings — a near-duplicate of the regular bookings flow, but debiting the company's pool instead of a personal membership.

book — a member booking a class
Class must exist, not be cancelled, not have already started.
Reject if this user already has a booked or waitlisted row for this class (no double-booking).
Requires an active membership (found via activeMembershipFor — active status + endDate >= today). No membership → hard reject.
Credit check: if creditsRemaining < creditCost and not unlimited (≥999) → reject.
Counts existing booked rows for the class (waitlisted rows don't count toward capacity) → decides isFull.
Inserts the booking: status: "waitlisted" if full, "booked" otherwise. Credits are only deducted if not full and not unlimited — a waitlisted booking spends 0 credits at booking time. That's an important rule: you only pay when you actually get a spot, not just for joining the waitlist.

cancel — cancelling a booking
Only the owner, or staff (admin/trainer), can cancel.
Must currently be booked or waitlisted — can't cancel something already cancelled/attended.
refundable = more than 12h before class start AND creditsUsed > 0. Note: a waitlisted booking always has creditsUsed: 0, so cancelling a waitlist spot never triggers a refund calc — correct, since no credit was ever spent on it.
Sets status to cancelled, timestamps it.
If refundable, credits go back onto the membership (capped so it never bumps someone up to the unlimited threshold).
The waitlist promotion, only if the cancelled booking was "booked" (not if it was "waitlisted" — makes sense, freeing a waitlist spot doesn't free a class spot): finds the longest-waiting waitlisted row for that class (orderBy bookedAt asc), promotes it to "booked", and deducts that class's credit cost from their membership.


This promotion logic is the single most fragile-looking piece in the file — it's doing a first-come-first-served promotion with its own credit deduction, separate from the book procedure's own deduction logic. This is exactly the kind of rule that needs a dedicated test: book class to capacity, waitlist one more, cancel a confirmed booking, assert the waitlisted person is now booked and their credits dropped.


markAttended (staff-only) — front desk / kiosk check-in

Only works on a booked row (not waitlisted, not already attended) → flips it to attended, logs a checkins row with the source. Straightforward.

Staff read queries
rosterFor — attendee list for a class.
upcomingForMember — a member's bookings starting within N hours (used by front desk to check someone in quickly, probably).
checkinCountFor — how many actually checked in for a class. 


waitlisted — a member's own waitlist queue position

For each of the member's waitlisted bookings, it counts how many other waitlisted rows for that same class have an earlier bookedAt — that count + 1 = their position. Computed live, not stored. Fine for correctness, but note it's an N+1 query pattern (one query per waitlisted booking) — not a bug, but a legitimate "could be one query with a window function" optimization note if you want a small credit-worthy improvement later.


Booking requires an active, unexpired membership.
Unlimited = creditsRemaining >= 999, never decrements.
Capacity counts only booked status; over capacity → auto-waitlist, 0 credits charged.
Refund only if cancelled >12h before start and credits were actually spent.
Cancelling a booked (not waitlisted) spot auto-promotes the longest-waiting waitlisted person, charging them.