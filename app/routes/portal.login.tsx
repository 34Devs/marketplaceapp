import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, Form, Link } from "@remix-run/react";
import { authenticateVendor } from "../lib/vendor.server";
import { createVendorSession, getVendorId } from "../lib/portal-auth.server";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await getVendorId(request);
  if (vendorId) {
    return redirect("/apps/vendorhub");
  }
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  // Extract shop from the app proxy request or use a default for development
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "dev-store.myshopify.com";

  const vendor = await authenticateVendor(shop, email, password);

  if (!vendor) {
    return json({ error: "Invalid email or password" }, { status: 401 });
  }

  return createVendorSession(vendor.id, "/apps/vendorhub");
};

export default function PortalLogin() {
  const actionData = useActionData<typeof action>();
  const basePath = "/apps/vendorhub";

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="vh-card" style={{ textAlign: "center", padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Vendor Login
        </h1>
        <p style={{ color: "#6d7175", marginBottom: 24 }}>
          Sign in to your vendor dashboard
        </p>

        {actionData?.error && (
          <div className="vh-alert vh-alert-error">{actionData.error}</div>
        )}

        <Form method="post">
          <div className="vh-form-group" style={{ textAlign: "left" }}>
            <label className="vh-label" htmlFor="email">Email</label>
            <input
              className="vh-input"
              type="email"
              id="email"
              name="email"
              placeholder="vendor@example.com"
              required
            />
          </div>

          <div className="vh-form-group" style={{ textAlign: "left" }}>
            <label className="vh-label" htmlFor="password">Password</label>
            <input
              className="vh-input"
              type="password"
              id="password"
              name="password"
              placeholder="Your password"
              required
            />
          </div>

          <button type="submit" className="vh-btn vh-btn-primary" style={{ width: "100%", padding: "12px", fontSize: 15 }}>
            Sign In
          </button>
        </Form>

        <p style={{ marginTop: 16, fontSize: 14, color: "#6d7175" }}>
          Don't have an account?{" "}
          <Link to={`${basePath}/register`} style={{ color: "#5c2dbc" }}>
            Apply to sell
          </Link>
        </p>
      </div>
    </div>
  );
}
