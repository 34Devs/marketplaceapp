import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const orderItems = await db.vendorOrderItem.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: { shopifyOrderName: true, customerEmail: true, currency: true },
      },
      commission: {
        select: { commissionAmount: true, vendorEarnings: true, status: true },
      },
    },
  });

  return json({ orderItems });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const vendorId = await requireVendorId(request);
  const formData = await request.formData();
  const itemId = formData.get("itemId") as string;

  if (itemId) {
    const item = await db.vendorOrderItem.findUnique({
      where: { id: itemId },
    });

    if (item && item.vendorId === vendorId) {
      await db.vendorOrderItem.update({
        where: { id: itemId },
        data: {
          fulfillmentStatus: "FULFILLED",
          fulfilledAt: new Date(),
        },
      });
    }
  }

  return json({ success: true });
};

export default function PortalOrders() {
  const { orderItems } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const formatCurrency = (amount: number, currency: string = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  const handleFulfill = (itemId: string) => {
    if (!confirm("Mark this item as fulfilled?")) return;
    const formData = new FormData();
    formData.set("itemId", itemId);
    submit(formData, { method: "post" });
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>My Orders</h1>

      {orderItems.length > 0 ? (
        <div className="vh-card">
          <table className="vh-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Your Earnings</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.order.shopifyOrderName}</td>
                  <td>{item.order.customerEmail || "N/A"}</td>
                  <td>{item.title}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.totalAmount, item.currency)}</td>
                  <td style={{ color: "#008060", fontWeight: 500 }}>
                    {item.commission
                      ? formatCurrency(item.commission.vendorEarnings, item.currency)
                      : "-"}
                  </td>
                  <td>
                    <span
                      className={`vh-badge ${
                        item.fulfillmentStatus === "FULFILLED"
                          ? "vh-badge-success"
                          : "vh-badge-warning"
                      }`}
                    >
                      {item.fulfillmentStatus}
                    </span>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    {item.fulfillmentStatus === "UNFULFILLED" && (
                      <button
                        className="vh-btn vh-btn-success"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => handleFulfill(item.id)}
                      >
                        Fulfill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="vh-card vh-empty">
          <p>No orders yet. Orders will appear here when customers purchase your products.</p>
        </div>
      )}
    </div>
  );
}
