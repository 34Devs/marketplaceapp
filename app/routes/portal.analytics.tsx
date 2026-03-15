import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const [
    vendor,
    productStats,
    orderStats,
    commissionStats,
    topProducts,
    recentReviews,
    monthlySales,
  ] = await Promise.all([
    db.vendor.findUnique({
      where: { id: vendorId },
      select: { totalSales: true, totalOrders: true, rating: true },
    }),
    db.vendorProduct.groupBy({
      by: ["status"],
      where: { vendorId },
      _count: true,
    }),
    db.vendorOrderItem.groupBy({
      by: ["fulfillmentStatus"],
      where: { vendorId },
      _count: true,
      _sum: { totalAmount: true },
    }),
    db.commission.aggregate({
      where: { vendorId },
      _sum: { commissionAmount: true, vendorEarnings: true, orderAmount: true },
    }),
    db.vendorOrderItem.groupBy({
      by: ["title"],
      where: { vendorId },
      _count: true,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    db.vendorReview.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        customerName: true,
        rating: true,
        title: true,
        body: true,
        isVerified: true,
        createdAt: true,
      },
    }),
    // Last 6 months of sales
    db.vendorOrderItem.findMany({
      where: {
        vendorId,
        createdAt: {
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        },
      },
      select: { totalAmount: true, createdAt: true },
    }),
  ]);

  // Aggregate monthly sales
  const monthlyMap = new Map<string, number>();
  for (const item of monthlySales) {
    const key = new Date(item.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + item.totalAmount);
  }

  return json({
    vendor,
    productStats: Object.fromEntries(productStats.map((p) => [p.status, p._count])),
    orderStats,
    totalCommissionPaid: commissionStats._sum.commissionAmount ?? 0,
    totalEarnings: commissionStats._sum.vendorEarnings ?? 0,
    totalOrderAmount: commissionStats._sum.orderAmount ?? 0,
    topProducts,
    recentReviews,
    monthlySales: Array.from(monthlyMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    })),
  });
};

export default function PortalAnalytics() {
  const {
    vendor,
    productStats,
    orderStats,
    totalCommissionPaid,
    totalEarnings,
    topProducts,
    recentReviews,
    monthlySales,
  } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const fulfilledOrders = orderStats.find((o) => o.fulfillmentStatus === "FULFILLED");
  const unfulfilledOrders = orderStats.find((o) => o.fulfillmentStatus === "UNFULFILLED");

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Analytics</h1>

      <div className="vh-grid vh-grid-4 vh-mb-24">
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(vendor?.totalSales ?? 0)}</div>
          <div className="vh-stat-label">Total Sales</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(totalEarnings)}</div>
          <div className="vh-stat-label">Total Earnings</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(totalCommissionPaid)}</div>
          <div className="vh-stat-label">Commission Paid</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">
            {vendor?.rating ? `${vendor.rating.toFixed(1)}/5` : "N/A"}
          </div>
          <div className="vh-stat-label">Rating</div>
        </div>
      </div>

      <div className="vh-grid vh-grid-2 vh-mb-24">
        <div className="vh-card">
          <h2>Product Breakdown</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="vh-flex vh-flex-between">
              <span>Approved</span>
              <strong>{productStats.APPROVED ?? 0}</strong>
            </div>
            <div className="vh-flex vh-flex-between">
              <span>Pending</span>
              <strong>{productStats.PENDING ?? 0}</strong>
            </div>
            <div className="vh-flex vh-flex-between">
              <span>Rejected</span>
              <strong>{productStats.REJECTED ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="vh-card">
          <h2>Order Status</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="vh-flex vh-flex-between">
              <span>Fulfilled</span>
              <strong>
                {fulfilledOrders?._count ?? 0} ({formatCurrency(fulfilledOrders?._sum.totalAmount ?? 0)})
              </strong>
            </div>
            <div className="vh-flex vh-flex-between">
              <span>Unfulfilled</span>
              <strong>
                {unfulfilledOrders?._count ?? 0} ({formatCurrency(unfulfilledOrders?._sum.totalAmount ?? 0)})
              </strong>
            </div>
          </div>
        </div>
      </div>

      {monthlySales.length > 0 && (
        <div className="vh-card vh-mb-24">
          <h2>Monthly Sales (Last 6 Months)</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 150 }}>
            {monthlySales.map((m) => {
              const maxAmount = Math.max(...monthlySales.map((s) => s.amount));
              const heightPct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
              return (
                <div key={m.month} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      height: `${Math.max(heightPct, 5)}%`,
                      background: "#5c2dbc",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#6d7175", marginTop: 4 }}>{m.month}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{formatCurrency(m.amount)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="vh-grid vh-grid-2">
        <div className="vh-card">
          <h2>Top Products</h2>
          {topProducts.length > 0 ? (
            <table className="vh-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i}>
                    <td>{p.title}</td>
                    <td>{p._count}</td>
                    <td>{formatCurrency(p._sum.totalAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="vh-empty"><p>No sales data yet.</p></div>
          )}
        </div>

        <div className="vh-card">
          <h2>Recent Reviews</h2>
          {recentReviews.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {recentReviews.map((r, i) => (
                <div key={i} style={{ padding: 12, border: "1px solid #e1e3e5", borderRadius: 8 }}>
                  <div className="vh-flex vh-flex-between vh-flex-center">
                    <strong>{r.customerName}</strong>
                    <span style={{ color: "#f5a623" }}>
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </span>
                  </div>
                  {r.title && <div style={{ fontWeight: 500, marginTop: 4 }}>{r.title}</div>}
                  {r.body && (
                    <p style={{ fontSize: 13, color: "#6d7175", margin: "4px 0 0" }}>{r.body}</p>
                  )}
                  <div style={{ fontSize: 11, color: "#8c9196", marginTop: 4 }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.isVerified && " · Verified Purchase"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="vh-empty"><p>No reviews yet.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
