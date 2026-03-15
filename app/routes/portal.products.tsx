import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const products = await db.vendorProduct.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
  });

  return json({ products });
};

function statusBadge(status: string) {
  const classMap: Record<string, string> = {
    APPROVED: "vh-badge-success",
    PENDING: "vh-badge-warning",
    REJECTED: "vh-badge-danger",
    ARCHIVED: "vh-badge-info",
  };
  return <span className={`vh-badge ${classMap[status] || ""}`}>{status}</span>;
}

export default function PortalProducts() {
  const { products } = useLoaderData<typeof loader>();
  const basePath = "/apps/vendorhub";

  return (
    <div>
      <div className="vh-flex vh-flex-between vh-flex-center vh-mb-24">
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Products</h1>
        <Link to={`${basePath}/products/new`} className="vh-btn vh-btn-primary">
          Add Product
        </Link>
      </div>

      {products.length > 0 ? (
        <div className="vh-card">
          <table className="vh-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Commission</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 500 }}>{product.title}</td>
                  <td>{statusBadge(product.status)}</td>
                  <td>{product.commissionRate ? `${product.commissionRate}%` : "Default"}</td>
                  <td>{new Date(product.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link
                      to={`${basePath}/products/${product.id}`}
                      className="vh-btn vh-btn-secondary"
                      style={{ padding: "4px 12px", fontSize: 13 }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="vh-card vh-empty">
          <p style={{ fontSize: 16, marginBottom: 16 }}>You haven't added any products yet</p>
          <Link to={`${basePath}/products/new`} className="vh-btn vh-btn-primary">
            Add Your First Product
          </Link>
        </div>
      )}
    </div>
  );
}
