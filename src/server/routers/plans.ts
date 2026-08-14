import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { membershipPlans, memberships, payments } from "@/db/schema";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../trpc";
import { addDays } from "@/lib/booking-utils";

export const plansRouter = router({
  list: publicProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).default({}))
    .query(async ({ ctx, input }) => {
      if (input.includeInactive) {
        return ctx.db.select().from(membershipPlans);
      }
      return ctx.db
        .select()
        .from(membershipPlans)
        .where(eq(membershipPlans.active, true));
    }),

  subscribe: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        method: z.enum(["card", "cash", "upi", "transfer"]).default("card"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db
        .select()
        .from(membershipPlans)
        .where(eq(membershipPlans.id, input.planId))
        .get();

      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found." });
      }
      if (!plan.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This plan is no longer available.",
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      // Expire previous active memberships to prevent multiple active memberships stacking
      await ctx.db
        .update(memberships)
        .set({ status: "expired" })
        .where(
          and(
            eq(memberships.userId, ctx.user.id),
            eq(memberships.status, "active"),
          ),
        );

      const membership = await ctx.db
        .insert(memberships)
        .values({
          userId: ctx.user.id,
          planId: plan.id,
          startDate: today,
          endDate: addDays(today, plan.durationDays),
          creditsRemaining: plan.classCredits,
          status: "active",
        })
        .returning()
        .get();

      await ctx.db.insert(payments).values({
        userId: ctx.user.id,
        membershipId: membership.id,
        amountCents: plan.priceCents,
        method: input.method,
        status: "paid",
        reference: `PAY-${Date.now()}`,
      });

      return membership;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        priceCents: z.number().int().nonnegative(),
        durationDays: z.number().int().positive(),
        classCredits: z.number().int().nonnegative().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .insert(membershipPlans)
        .values({ ...input, description: input.description ?? null })
        .returning()
        .get();
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(membershipPlans)
        .set({ active: input.active })
        .where(eq(membershipPlans.id, input.id))
        .returning()
        .get();
    }),
});
