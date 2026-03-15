import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const [payouts, pendingEarnings, totalPaid, vendor] = await Promise.all([
    db.payout.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    }),
    db.commission.aggregate({
      where: { vendorId, status: "APPROVED" },
      _sum: { vendorEarnings: true },
    }),
    db.payout.aggregate({
      where: { vendorId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.vendor.findUnique({
      where: { id: vendorId },
      select: { payoutMethod: true, stripeConnectId: true, paypalEmail: true },
    }),
  ]);

  return json({
    payouts,
    pendingEarnings: pendingEarnings._sum.vendorEarnings ?? 0,
    totalPaid: totalPaid._sum.amount ?? 0,
    vendor,
  });
};

export default function PortalPayouts() {
  const { payouts, pendingEarnings, totalPaid, vendor } =
    useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const basePath = "/apps/vendorhub";

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>My Payouts</h1>

      <div className="vh-grid vh-grid-3 vh-mb-24">
        <div className="vh-card">
          <div className="vh-stat-value" style={{ color: "#008060" }}>
            {formatCurrency(pendingEarnings)}
          </div>
          <div className="vh-stat-label">Pending Earnings</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(totalPaid)}</div>
          <div className="vh-stat-label">Total Paid Out</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">
            {vendor?.payoutMethod || "Not Set"}
          </div>
          <div className="vh-stat-label">Payout Method</div>
        </div>
      </div>

      {!vendor?.payoutMethod && (
        <div className="vh-alert vh-alert-warning vh-mb-16">
          You haven't set up a payout method yet. Go to{" "}
          <a href={`${basePath}/profile`} style={{ color: "#5c2dbc" }}>
            your profile
          </a>{" "}
          to configure Stripe or PayPal.
        </div>
      )}

      <div className="vh-card">
        <h2>Payout History</h2>
        {payouts.length > 0 ? (
          <table className="vh-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td style={{ fontWeight: 600 }}>
                    {formatCurrency(payout.amount)}
                  </td>
                  <td>{payout.method}</td>
                  <td>
                    <span
                      className={`vh-badge ${
                        payout.status === "COMPLETED"
                          ? "vh-badge-success"
                          : payout.status === "FAILED"
                            ? "vh-badge-danger"
                            : "vh-badge-warning"
                      }`}
                    >
                      {payout.status}
                    </span>
                  </td>
                  <td>{payout.reference || "-"}</td>
                  <td>{new Date(payout.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="vh-empty">
            <p>No payouts yet. Earnings will be paid out based on the marketplace schedule.</p>
          </div>
        )}
      </div>
    </div>
  );
}
