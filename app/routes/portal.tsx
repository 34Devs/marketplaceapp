import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { getVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await getVendorId(request);

  let vendor = null;
  if (vendorId) {
    vendor = await db.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        storeName: true,
        status: true,
        logo: true,
        email: true,
      },
    });
  }

  return json({ vendor });
};

export default function PortalLayout() {
  const { vendor } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isAuthPage =
    location.pathname.includes("/login") ||
    location.pathname.includes("/register");

  const basePath = "/apps/vendorhub";

  const navItems = [
    { label: "Dashboard", path: basePath },
    { label: "Products", path: `${basePath}/products` },
    { label: "Orders", path: `${basePath}/orders` },
    { label: "Payouts", path: `${basePath}/payouts` },
    { label: "Messages", path: `${basePath}/messages` },
    { label: "Profile", path: `${basePath}/profile` },
  ];

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .vh-portal { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .vh-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 0; border-bottom: 1px solid #e1e3e5; margin-bottom: 24px;
        }
        .vh-logo { font-size: 20px; font-weight: 700; color: #202223; text-decoration: none; }
        .vh-nav { display: flex; gap: 8px; flex-wrap: wrap; }
        .vh-nav a {
          padding: 8px 16px; border-radius: 8px; text-decoration: none;
          color: #6d7175; font-size: 14px; font-weight: 500; transition: all 0.15s;
        }
        .vh-nav a:hover { background: #f6f6f7; color: #202223; }
        .vh-nav a.active { background: #f1f0fb; color: #5c2dbc; }
        .vh-user-info { display: flex; align-items: center; gap: 12px; }
        .vh-user-name { font-size: 14px; color: #6d7175; }
        .vh-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;
          text-decoration: none; cursor: pointer; border: none; transition: all 0.15s;
        }
        .vh-btn-primary { background: #5c2dbc; color: white; }
        .vh-btn-primary:hover { background: #4a23a0; }
        .vh-btn-secondary { background: #f6f6f7; color: #202223; border: 1px solid #c9cccf; }
        .vh-btn-secondary:hover { background: #e9eaeb; }
        .vh-btn-danger { background: #e51c00; color: white; }
        .vh-btn-success { background: #008060; color: white; }
        .vh-btn-success:hover { background: #006e52; }
        .vh-card {
          background: white; border: 1px solid #e1e3e5; border-radius: 12px;
          padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .vh-card h2 { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #202223; }
        .vh-grid { display: grid; gap: 16px; }
        .vh-grid-2 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
        .vh-grid-3 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .vh-grid-4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .vh-stat-value { font-size: 28px; font-weight: 700; color: #202223; }
        .vh-stat-label { font-size: 13px; color: #6d7175; margin-top: 4px; }
        .vh-input {
          width: 100%; padding: 10px 12px; border: 1px solid #c9cccf;
          border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box;
        }
        .vh-input:focus { border-color: #5c2dbc; box-shadow: 0 0 0 1px #5c2dbc; }
        .vh-label { display: block; font-size: 14px; font-weight: 500; color: #202223; margin-bottom: 6px; }
        .vh-form-group { margin-bottom: 16px; }
        .vh-textarea { min-height: 100px; resize: vertical; }
        .vh-table { width: 100%; border-collapse: collapse; }
        .vh-table th { text-align: left; padding: 10px 12px; font-size: 13px; color: #6d7175; border-bottom: 1px solid #e1e3e5; }
        .vh-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f1f1; }
        .vh-badge {
          display: inline-block; padding: 3px 10px; border-radius: 12px;
          font-size: 12px; font-weight: 600;
        }
        .vh-badge-success { background: #aee9d1; color: #0d5e3c; }
        .vh-badge-warning { background: #ffea8a; color: #6a5700; }
        .vh-badge-danger { background: #fed3d1; color: #8e1a0e; }
        .vh-badge-info { background: #d3e5ef; color: #1f5274; }
        .vh-alert {
          padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px;
        }
        .vh-alert-warning { background: #fff8e5; border: 1px solid #ffd79d; color: #6a5700; }
        .vh-alert-success { background: #e3f1df; border: 1px solid #95c9a1; color: #0d5e3c; }
        .vh-alert-error { background: #fce9e8; border: 1px solid #f5a29a; color: #8e1a0e; }
        .vh-empty { text-align: center; padding: 40px; color: #6d7175; }
        .vh-flex { display: flex; }
        .vh-flex-between { justify-content: space-between; }
        .vh-flex-center { align-items: center; }
        .vh-gap-8 { gap: 8px; }
        .vh-gap-16 { gap: 16px; }
        .vh-mb-16 { margin-bottom: 16px; }
        .vh-mb-24 { margin-bottom: 24px; }
      `}</style>

      <div className="vh-portal">
        {!isAuthPage && vendor && (
          <header className="vh-header">
            <Link to={basePath} className="vh-logo">
              VendorHub
            </Link>
            <nav className="vh-nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={location.pathname === item.path ? "active" : ""}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="vh-user-info">
              <span className="vh-user-name">{vendor.storeName}</span>
              <Link to={`${basePath}/logout`} className="vh-btn vh-btn-secondary">
                Logout
              </Link>
            </div>
          </header>
        )}

        {vendor && vendor.status === "PENDING" && !isAuthPage && (
          <div className="vh-alert vh-alert-warning">
            Your vendor account is pending approval. Some features may be limited until your account is approved.
          </div>
        )}

        {vendor && vendor.status === "SUSPENDED" && !isAuthPage && (
          <div className="vh-alert vh-alert-error">
            Your vendor account has been suspended. Please contact the marketplace administrator.
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}
