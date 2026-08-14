import { and, desc, eq, sql } from "drizzle-orm";
import { bookings, corporateBookings, memberships } from "@/db/schema";
import type { db } from "@/db";



/** Policy Constants */
export const FREE_CANCELLATION_HOURS = 12;
export const CORPORATE_FREE_CANCELLATION_HOURS = 24;
export const FREE_RESCHEDULE_HOURS = 4;
export const UNLIMITED_CREDITS = 999;

/**
 * Calculates hours remaining from now until a given ISO date string.
 */

export function hoursUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 36e5;
}

/**
 * Finds active, unexpired membership for a user.
 */
export async function activeMembershipFor(
  dbClient: typeof db,
  userId: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  return dbClient
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
        sql`${memberships.endDate} >= ${today}`,
      ),
    )
    .orderBy(desc(memberships.endDate))
    .get();
}

/**
 * Calculates total confirmed ("booked") spots for a class
 * across BOTH standard member bookings AND corporate bookings.
 */
export async function getTotalBookedCountForClass(
  dbClient: typeof db,
  classId: number,
): Promise<number> {
  const [{ count: regularCount }] = await dbClient
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(
      and(eq(bookings.classId, classId), eq(bookings.status, "booked")),
    );

  const [{ count: corporateCount }] = await dbClient
    .select({ count: sql<number>`count(*)` })
    .from(corporateBookings)
    .where(
      and(
        eq(corporateBookings.classId, classId),
        eq(corporateBookings.status, "booked"),
      ),
    );

  return Number(regularCount ?? 0) + Number(corporateCount ?? 0);
}

/**
 * Checks if a cancellation is eligible for a credit refund.
 */
export function isRefundableCancellation(
  startsAtIso: string,
  creditsUsed: number,
  freeCancellationHours: number = FREE_CANCELLATION_HOURS,
): boolean {
  return hoursUntil(startsAtIso) >= freeCancellationHours && creditsUsed > 0;
}

/**
 * Checks if a class is within the allowed reschedule window.
 */
export function isRescheduleAllowed(
  startsAtIso: string,
  freeRescheduleHours: number = FREE_RESCHEDULE_HOURS,
): boolean {
  return hoursUntil(startsAtIso) >= freeRescheduleHours;
}
