import { router } from "../trpc";
import { authRouter } from "./auth";
import { membersRouter } from "./members";
import { plansRouter } from "./plans";
import { classesRouter } from "./classes";
import { bookingsRouter } from "./bookings";
import { paymentsRouter } from "./payments";
import { adminRouter } from "./admin";

export const appRouter = router({
  auth: authRouter,
  members: membersRouter,
  plans: plansRouter,
  classes: classesRouter,
  bookings: bookingsRouter,
  payments: paymentsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
