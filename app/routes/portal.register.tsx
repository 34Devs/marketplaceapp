import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, Form, Link } from "@remix-run/react";
import { z } from "zod";
import { createVendor } from "../lib/vendor.server";
import { createVendorSession, getVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

const registerSchema = z
  .object({
    storeName: z.string().min(2, "Store name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    description: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await getVendorId(request);
  if (vendorId) {
    return redirect("/apps/vendorhub");
  }
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const rawData = {
    storeName: formData.get("storeName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    description: (formData.get("description") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
  };

  const result = registerSchema.safeParse(rawData);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0] || "Validation failed";
    return json({ error: firstError, fields: rawData }, { status: 400 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "dev-store.myshopify.com";

  // Check if registration is open
  const settings = await db.storeSettings.findUnique({
    where: { shop },
    select: { vendorRegistrationOpen: true },
  });

  if (settings && !settings.vendorRegistrationOpen) {
    return json(
      { error: "Vendor registration is currently closed", fields: rawData },
      { status: 403 },
    );
  }

  // Check if email already exists
  const existing = await db.vendor.findUnique({
    where: { shop_email: { shop, email: result.data.email } },
  });

  if (existing) {
    return json(
      { error: "An account with this email already exists", fields: rawData },
      { status: 400 },
    );
  }

  try {
    const vendor = await createVendor(shop, {
      email: result.data.email,
      storeName: result.data.storeName,
      password: result.data.password,
      description: result.data.description,
      phone: result.data.phone,
    });

    return createVendorSession(vendor.id, "/apps/vendorhub");
  } catch (error) {
    return json(
      { error: "Registration failed. Please try again.", fields: rawData },
      { status: 500 },
    );
  }
};

export default function PortalRegister() {
  const actionData = useActionData<typeof action>();
  const basePath = "/apps/vendorhub";

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <div className="vh-card" style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
          Become a Vendor
        </h1>
        <p style={{ color: "#6d7175", marginBottom: 24, textAlign: "center" }}>
          Apply to sell on our marketplace
        </p>

        {actionData?.error && (
          <div className="vh-alert vh-alert-error">{actionData.error}</div>
        )}

        <Form method="post">
          <div className="vh-form-group">
            <label className="vh-label" htmlFor="storeName">Store Name *</label>
            <input
              className="vh-input"
              type="text"
              id="storeName"
              name="storeName"
              placeholder="My Awesome Store"
              defaultValue={actionData?.fields?.storeName}
              required
            />
          </div>

          <div className="vh-form-group">
            <label className="vh-label" htmlFor="email">Email Address *</label>
            <input
              className="vh-input"
              type="email"
              id="email"
              name="email"
              placeholder="vendor@example.com"
              defaultValue={actionData?.fields?.email}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="vh-form-group">
              <label className="vh-label" htmlFor="password">Password *</label>
              <input
                className="vh-input"
                type="password"
                id="password"
                name="password"
                placeholder="Min. 8 characters"
                required
              />
            </div>
            <div className="vh-form-group">
              <label className="vh-label" htmlFor="confirmPassword">Confirm Password *</label>
              <input
                className="vh-input"
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm password"
                required
              />
            </div>
          </div>

          <div className="vh-form-group">
            <label className="vh-label" htmlFor="description">Store Description</label>
            <textarea
              className="vh-input vh-textarea"
              id="description"
              name="description"
              placeholder="Tell us about your store and what you sell..."
              defaultValue={actionData?.fields?.description}
            />
          </div>

          <div className="vh-form-group">
            <label className="vh-label" htmlFor="phone">Phone Number</label>
            <input
              className="vh-input"
              type="tel"
              id="phone"
              name="phone"
              placeholder="+1 (555) 000-0000"
              defaultValue={actionData?.fields?.phone}
            />
          </div>

          <button type="submit" className="vh-btn vh-btn-primary" style={{ width: "100%", padding: "12px", fontSize: 15 }}>
            Submit Application
          </button>
        </Form>

        <p style={{ marginTop: 16, fontSize: 14, color: "#6d7175", textAlign: "center" }}>
          Already have an account?{" "}
          <Link to={`${basePath}/login`} style={{ color: "#5c2dbc" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
