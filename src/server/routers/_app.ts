import { router } from "../trpc";
import { authRouter } from "./auth";
import { membersRouter } from "./members";
import { plansRouter } from "./plans";
import { classesRouter } from "./classes";
import { bookingsRouter } from "./bookings";
import { paymentsRouter } from "./payments";
import { adminRouter } from "./admin";
import { notificationsRouter } from "./notifications";
import { trainersRouter } from "./trainers";

export const appRouter = router({
  auth: authRouter,
  members: membersRouter,
  plans: plansRouter,
  classes: classesRouter,
  bookings: bookingsRouter,
  payments: paymentsRouter,
  admin: adminRouter,
  notifications: notificationsRouter,
  trainers: trainersRouter,
});

export type AppRouter = typeof appRouter;
