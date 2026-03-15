import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: {
      storeName: true,
      status: true,
      totalSales: true,
      totalOrders: true,
      rating: true,
    },
  });

  if (!vendor) throw new Response("Vendor not found", { status: 404 });

  const [productCount, pendingOrders, pendingEarnings, recentOrders] =
    await Promise.all([
      db.vendorProduct.count({ where: { vendorId } }),
      db.vendorOrderItem.count({
        where: { vendorId, fulfillmentStatus: "UNFULFILLED" },
      }),
      db.commission.aggregate({
        where: { vendorId, status: "APPROVED" },
        _sum: { vendorEarnings: true },
      }),
      db.vendorOrderItem.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          order: { select: { shopifyOrderName: true } },
        },
      }),
    ]);

  return json({
    vendor,
    productCount,
    pendingOrders,
    pendingEarnings: pendingEarnings._sum.vendorEarnings ?? 0,
    recentOrders,
  });
};

export default function PortalDashboard() {
  const { vendor, productCount, pendingOrders, pendingEarnings, recentOrders } =
    useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const basePath = "/apps/vendorhub";

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Welcome back, {vendor.storeName}!
      </h1>

      <div className="vh-grid vh-grid-4 vh-mb-24">
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(vendor.totalSales)}</div>
          <div className="vh-stat-label">Total Sales</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{vendor.totalOrders}</div>
          <div className="vh-stat-label">Total Orders</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{formatCurrency(pendingEarnings)}</div>
          <div className="vh-stat-label">Pending Earnings</div>
        </div>
        <div className="vh-card">
          <div className="vh-stat-value">{productCount}</div>
          <div className="vh-stat-label">Products</div>
        </div>
      </div>

      <div className="vh-grid vh-grid-2">
        <div className="vh-card">
          <h2>Quick Actions</h2>
          <div className="vh-flex vh-gap-8" style={{ flexWrap: "wrap" }}>
            <Link to={`${basePath}/products/new`} className="vh-btn vh-btn-primary">
              Add Product
            </Link>
            <Link to={`${basePath}/orders`} className="vh-btn vh-btn-secondary">
              View Orders {pendingOrders > 0 && `(${pendingOrders} pending)`}
            </Link>
            <Link to={`${basePath}/payouts`} className="vh-btn vh-btn-secondary">
              Payouts
            </Link>
          </div>
        </div>

        <div className="vh-card">
          <h2>Store Stats</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="vh-flex vh-flex-between">
              <span style={{ color: "#6d7175" }}>Rating</span>
              <strong>{vendor.rating > 0 ? `${vendor.rating.toFixed(1)} / 5.0` : "No ratings yet"}</strong>
            </div>
            <div className="vh-flex vh-flex-between">
              <span style={{ color: "#6d7175" }}>Unfulfilled Orders</span>
              <strong>{pendingOrders}</strong>
            </div>
            <div className="vh-flex vh-flex-between">
              <span style={{ color: "#6d7175" }}>Status</span>
              <span className={`vh-badge vh-badge-${vendor.status === "APPROVED" ? "success" : "warning"}`}>
                {vendor.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="vh-card" style={{ marginTop: 16 }}>
        <h2>Recent Orders</h2>
        {recentOrders.length > 0 ? (
          <table className="vh-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((item) => (
                <tr key={item.id}>
                  <td>{item.order.shopifyOrderName}</td>
                  <td>{item.title}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.totalAmount)}</td>
                  <td>
                    <span className={`vh-badge vh-badge-${item.fulfillmentStatus === "FULFILLED" ? "success" : "warning"}`}>
                      {item.fulfillmentStatus}
                    </span>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="vh-empty">
            <p>No orders yet. Start by adding products to your store!</p>
          </div>
        )}
      </div>
    </div>
  );
}
