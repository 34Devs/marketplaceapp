import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: {
      storeName: true,
      slug: true,
      email: true,
      description: true,
      phone: true,
      logo: true,
      banner: true,
      address: true,
      payoutMethod: true,
      stripeConnectId: true,
      paypalEmail: true,
      status: true,
      createdAt: true,
    },
  });

  if (!vendor) throw new Response("Vendor not found", { status: 404 });

  return json({ vendor });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const vendorId = await requireVendorId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "profile") {
    await db.vendor.update({
      where: { id: vendorId },
      data: {
        storeName: formData.get("storeName") as string,
        description: (formData.get("description") as string) || null,
        phone: (formData.get("phone") as string) || null,
      },
    });
    return json({ success: true, message: "Profile updated!" });
  }

  if (intent === "payout") {
    const payoutMethod = formData.get("payoutMethod") as string;
    const updateData: Record<string, unknown> = {};

    if (payoutMethod === "PAYPAL") {
      updateData.payoutMethod = "PAYPAL";
      updateData.paypalEmail = formData.get("paypalEmail") as string;
    } else if (payoutMethod === "STRIPE") {
      updateData.payoutMethod = "STRIPE";
      // Stripe Connect onboarding would redirect to Stripe here
    }

    await db.vendor.update({
      where: { id: vendorId },
      data: updateData,
    });
    return json({ success: true, message: "Payout settings updated!" });
  }

  return json({ success: false, message: "" });
};

export default function PortalProfile() {
  const { vendor } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>My Profile</h1>

      {actionData?.success && (
        <div className="vh-alert vh-alert-success">{actionData.message}</div>
      )}

      <div className="vh-grid vh-grid-2">
        <div>
          <div className="vh-card">
            <h2>Store Information</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="profile" />

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="storeName">Store Name</label>
                <input
                  className="vh-input"
                  type="text"
                  id="storeName"
                  name="storeName"
                  defaultValue={vendor.storeName}
                  required
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="email">Email</label>
                <input
                  className="vh-input"
                  type="email"
                  id="email"
                  value={vendor.email}
                  disabled
                  style={{ background: "#f6f6f7" }}
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="description">Description</label>
                <textarea
                  className="vh-input vh-textarea"
                  id="description"
                  name="description"
                  defaultValue={vendor.description || ""}
                  placeholder="Tell customers about your store..."
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="phone">Phone</label>
                <input
                  className="vh-input"
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={vendor.phone || ""}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <button type="submit" className="vh-btn vh-btn-primary" style={{ padding: "10px 24px" }}>
                Save Profile
              </button>
            </Form>
          </div>
        </div>

        <div>
          <div className="vh-card">
            <h2>Payout Settings</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="payout" />

              <div className="vh-form-group">
                <label className="vh-label">Payout Method</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="payoutMethod"
                      value="PAYPAL"
                      defaultChecked={vendor.payoutMethod === "PAYPAL" || !vendor.payoutMethod}
                    />
                    PayPal
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="payoutMethod"
                      value="STRIPE"
                      defaultChecked={vendor.payoutMethod === "STRIPE"}
                    />
                    Stripe
                  </label>
                </div>
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="paypalEmail">PayPal Email</label>
                <input
                  className="vh-input"
                  type="email"
                  id="paypalEmail"
                  name="paypalEmail"
                  defaultValue={vendor.paypalEmail || ""}
                  placeholder="paypal@example.com"
                />
              </div>

              {vendor.stripeConnectId && (
                <div className="vh-alert vh-alert-success" style={{ marginBottom: 12 }}>
                  Stripe account connected
                </div>
              )}

              <button type="submit" className="vh-btn vh-btn-primary" style={{ padding: "10px 24px" }}>
                Save Payout Settings
              </button>
            </Form>
          </div>

          <div className="vh-card" style={{ marginTop: 16 }}>
            <h2>Account Info</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Store URL Slug</span>
                <strong>{vendor.slug}</strong>
              </div>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Status</span>
                <span className={`vh-badge ${vendor.status === "APPROVED" ? "vh-badge-success" : "vh-badge-warning"}`}>
                  {vendor.status}
                </span>
              </div>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Member Since</span>
                <strong>{new Date(vendor.createdAt).toLocaleDateString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
