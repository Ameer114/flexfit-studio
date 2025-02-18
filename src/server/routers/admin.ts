import { z } from "zod";
import { and, eq, gte, sql, lte, desc } from "drizzle-orm";
import {
  users,
  memberships,
  classes,
  bookings,
  payments,
  checkins,
  membershipPlans,
} from "@/db/schema";
import { router, adminProcedure } from "../trpc";

export const adminRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const [{ totalMembers }] = await ctx.db
      .select({ totalMembers: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "member"));

    const [{ activeMemberships }] = await ctx.db
      .select({ activeMemberships: sql<number>`count(*)` })
      .from(memberships)
      .where(
        and(
          eq(memberships.status, "active"),
          sql`${memberships.endDate} >= ${today}`,
        ),
      );

    const [{ upcomingClasses }] = await ctx.db
      .select({ upcomingClasses: sql<number>`count(*)` })
      .from(classes)
      .where(and(gte(classes.startsAt, now), eq(classes.cancelled, false)));

    const [{ revenueCents }] = await ctx.db
      .select({ revenueCents: sql<number>`coalesce(sum(amount_cents), 0)` })
      .from(payments)
      .where(eq(payments.status, "paid"));

    const [{ totalCheckins }] = await ctx.db
      .select({ totalCheckins: sql<number>`count(*)` })
      .from(checkins);

    const [{ pendingPayments }] = await ctx.db
      .select({ pendingPayments: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.status, "pending"));

    return {
      totalMembers: Number(totalMembers),
      activeMemberships: Number(activeMemberships),
      upcomingClasses: Number(upcomingClasses),
      revenueCents: Number(revenueCents),
      totalCheckins: Number(totalCheckins),
      pendingPayments: Number(pendingPayments),
    };
  }),

  classUtilisation: adminProcedure
    .input(z.object({ limit: z.number().default(10) }).default({}))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: classes.id,
          name: classes.name,
          startsAt: classes.startsAt,
          capacity: classes.capacity,
          booked: sql<number>`(
            select count(*) from ${bookings}
            where ${bookings.classId} = ${classes.id}
              and ${bookings.status} in ('booked','attended')
          )`.as("booked"),
        })
        .from(classes)
        .where(eq(classes.cancelled, false))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        booked: Number(r.booked),
        utilisation: r.capacity ? Number(r.booked) / r.capacity : 0,
      }));
    }),

  revenueByMonth: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        month: sql<string>`strftime('%Y-%m', ${payments.createdAt})`,
        totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments)
      .where(eq(payments.status, "paid"))
      .groupBy(sql`strftime('%Y-%m', ${payments.createdAt})`)
      .orderBy(sql`strftime('%Y-%m', ${payments.createdAt}) DESC`);

    return rows.map((r) => ({
      month: r.month,
      totalCents: Number(r.totalCents),
    }));
  }),

  revenueByMethod: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        method: payments.method,
        totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(eq(payments.status, "paid"))
      .groupBy(payments.method)
      .orderBy(sql`sum(${payments.amountCents}) DESC`);

    return rows.map((r) => ({
      method: r.method,
      totalCents: Number(r.totalCents),
      count: Number(r.count),
    }));
  }),

  expiringMemberships: adminProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);
    const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const rows = await ctx.db
      .select({
        memberId: users.id,
        memberName: users.name,
        memberEmail: users.email,
        planName: membershipPlans.name,
        expiresAt: memberships.endDate,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .innerJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(
        and(
          eq(memberships.status, "active"),
          gte(memberships.endDate, today),
          lte(memberships.endDate, in14Days),
        ),
      )
      .orderBy(memberships.endDate);

    return rows;
  }),

  refundCount: adminProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.status, "refunded"));

    return { count: Number(result.count) };
  }),
});
