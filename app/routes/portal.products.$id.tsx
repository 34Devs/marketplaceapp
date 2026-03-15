import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link } from "@remix-run/react";
import { requireVendorId } from "../lib/portal-auth.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const vendorId = await requireVendorId(request);

  const product = await db.vendorProduct.findUnique({
    where: { id: params.id },
  });

  if (!product || product.vendorId !== vendorId) {
    throw new Response("Product not found", { status: 404 });
  }

  return json({ product });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const vendorId = await requireVendorId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const product = await db.vendorProduct.findUnique({
    where: { id: params.id },
  });

  if (!product || product.vendorId !== vendorId) {
    throw new Response("Product not found", { status: 404 });
  }

  if (intent === "delete") {
    await db.vendorProduct.update({
      where: { id: params.id },
      data: { status: "ARCHIVED" },
    });
    return redirect("/apps/vendorhub/products");
  }

  // Update product title locally (Shopify sync would need admin API)
  const title = formData.get("title") as string;
  if (title) {
    await db.vendorProduct.update({
      where: { id: params.id },
      data: { title },
    });
  }

  return json({ success: true });
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

export default function EditProduct() {
  const { product } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePath = "/apps/vendorhub";

  return (
    <div>
      <div className="vh-flex vh-flex-between vh-flex-center vh-mb-24">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            {product.title}
          </h1>
          <div>{statusBadge(product.status)}</div>
        </div>
        <Link to={`${basePath}/products`} className="vh-btn vh-btn-secondary">
          Back to Products
        </Link>
      </div>

      {actionData?.success && (
        <div className="vh-alert vh-alert-success">Product updated successfully!</div>
      )}

      <div className="vh-grid vh-grid-2">
        <div className="vh-card">
          <h2>Edit Product</h2>
          <Form method="post">
            <div className="vh-form-group">
              <label className="vh-label" htmlFor="title">Title</label>
              <input
                className="vh-input"
                type="text"
                id="title"
                name="title"
                defaultValue={product.title}
              />
            </div>

            <button
              type="submit"
              className="vh-btn vh-btn-primary"
              style={{ padding: "10px 24px" }}
            >
              Save Changes
            </button>
          </Form>
        </div>

        <div>
          <div className="vh-card">
            <h2>Product Info</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Status</span>
                {statusBadge(product.status)}
              </div>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Commission</span>
                <strong>{product.commissionRate ? `${product.commissionRate}%` : "Default"}</strong>
              </div>
              <div className="vh-flex vh-flex-between">
                <span style={{ color: "#6d7175" }}>Created</span>
                <strong>{new Date(product.createdAt).toLocaleDateString()}</strong>
              </div>
            </div>
          </div>

          {product.status !== "ARCHIVED" && (
            <div className="vh-card" style={{ marginTop: 16 }}>
              <h2>Danger Zone</h2>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  className="vh-btn vh-btn-danger"
                  style={{ width: "100%" }}
                  onClick={(e) => {
                    if (!confirm("Are you sure you want to archive this product?")) {
                      e.preventDefault();
                    }
                  }}
                >
                  Archive Product
                </button>
              </Form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
