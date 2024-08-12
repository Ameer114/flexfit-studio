"use client";

import { trpc } from "@/lib/trpc";
import { formatDate, formatDateTime } from "@/lib/format";

export default function DashboardPage() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.members.profile.useQuery(undefined, {
    retry: false,
  });
  const { data: bookings } = trpc.bookings.mine.useQuery({ includePast: false });

  const cancel = trpc.bookings.cancel.useMutation({
    onSuccess: async () => {
      await utils.bookings.mine.invalidate();
      await utils.members.profile.invalidate();
      await utils.classes.list.invalidate();
    },
  });

  if (isLoading) return <p className="muted">Loading...</p>;
  if (!profile) return <p className="muted">Please sign in to view your bookings.</p>;

  const ms = profile.membership;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {profile.name.split(" ")[0]}
        </h1>
        <p className="muted mt-1 text-sm">
          {profile.classesAttended} classes attended
        </p>
      </div>

      <section className="panel p-5">
        <h2 className="font-medium">Membership</h2>
        {ms ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="muted">Plan</dt>
              <dd>{ms.planName}</dd>
            </div>
            <div>
              <dt className="muted">Status</dt>
              <dd>{ms.status}</dd>
            </div>
            <div>
              <dt className="muted">Valid until</dt>
              <dd>{formatDate(ms.endDate)}</dd>
            </div>
            <div>
              <dt className="muted">Credits</dt>
              <dd>{ms.creditsRemaining >= 999 ? "Unlimited" : ms.creditsRemaining}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted mt-2 text-sm">
            No active membership. Pick a plan to start booking classes.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Upcoming bookings</h2>

        {cancel.error && (
          <p className="panel p-3 text-sm" style={{ color: "#f87171" }}>
            {cancel.error.message}
          </p>
        )}

        {bookings?.length ? (
          <div className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="panel flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{b.className}</h3>
                    <span className="muted text-xs uppercase tracking-wide">
                      {b.status}
                    </span>
                  </div>
                  <p className="muted mt-0.5 text-sm">
                    {formatDateTime(b.startsAt)} &middot; {b.room}
                  </p>
                </div>

                {(b.status === "booked" || b.status === "waitlisted") && (
                  <button
                    className="btn"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ bookingId: b.id })}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">No upcoming bookings.</p>
        )}
      </section>
    </div>
  );
}
