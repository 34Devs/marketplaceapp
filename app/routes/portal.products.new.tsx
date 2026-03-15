import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, Form, Link } from "@remix-run/react";
import { z } from "zod";
import { requireVendorId } from "../lib/portal-auth.server";
import { createProductInShopify } from "../lib/product-sync.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const productSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  productType: z.string().optional(),
  tags: z.string().optional(),
  sku: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireVendorId(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const vendorId = await requireVendorId(request);
  const formData = await request.formData();

  const rawData = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    price: formData.get("price") as string,
    productType: (formData.get("productType") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
    sku: (formData.get("sku") as string) || undefined,
  };

  const result = productSchema.safeParse(rawData);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0] || "Validation failed";
    return json({ error: firstError, fields: rawData }, { status: 400 });
  }

  // Check vendor status
  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: { status: true, shop: true },
  });

  if (!vendor || vendor.status !== "APPROVED") {
    return json(
      { error: "Your account must be approved before adding products", fields: rawData },
      { status: 403 },
    );
  }

  try {
    // Get admin API client via stored session
    const session = await db.session.findFirst({
      where: { shop: vendor.shop, isOnline: false },
    });

    if (!session) {
      return json(
        { error: "Store session not found. Please contact admin.", fields: rawData },
        { status: 500 },
      );
    }

    // Use the Shopify REST Admin API approach for offline access
    const { admin } = await authenticate.admin(request).catch(() => {
      throw new Error("Admin auth failed");
    });

    await createProductInShopify(admin, vendor.shop, vendorId, {
      title: result.data.title,
      descriptionHtml: result.data.description
        ? `<p>${result.data.description}</p>`
        : undefined,
      productType: result.data.productType,
      tags: result.data.tags?.split(",").map((t) => t.trim()),
      variants: [
        {
          price: result.data.price,
          sku: result.data.sku,
        },
      ],
    });

    return redirect("/apps/vendorhub/products");
  } catch (error) {
    console.error("Product creation error:", error);
    return json(
      { error: "Failed to create product. Please try again.", fields: rawData },
      { status: 500 },
    );
  }
};

export default function NewProduct() {
  const actionData = useActionData<typeof action>();
  const basePath = "/apps/vendorhub";

  return (
    <div>
      <div className="vh-flex vh-flex-between vh-flex-center vh-mb-24">
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Add New Product</h1>
        <Link to={`${basePath}/products`} className="vh-btn vh-btn-secondary">
          Cancel
        </Link>
      </div>

      {actionData?.error && (
        <div className="vh-alert vh-alert-error">{actionData.error}</div>
      )}

      <Form method="post">
        <div className="vh-grid vh-grid-2">
          <div>
            <div className="vh-card">
              <h2>Product Details</h2>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="title">Title *</label>
                <input
                  className="vh-input"
                  type="text"
                  id="title"
                  name="title"
                  placeholder="Product title"
                  defaultValue={actionData?.fields?.title}
                  required
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="description">Description</label>
                <textarea
                  className="vh-input vh-textarea"
                  id="description"
                  name="description"
                  placeholder="Describe your product..."
                  defaultValue={actionData?.fields?.description}
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="productType">Product Type</label>
                <input
                  className="vh-input"
                  type="text"
                  id="productType"
                  name="productType"
                  placeholder="e.g., T-Shirt, Electronics"
                  defaultValue={actionData?.fields?.productType}
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="tags">Tags (comma separated)</label>
                <input
                  className="vh-input"
                  type="text"
                  id="tags"
                  name="tags"
                  placeholder="tag1, tag2, tag3"
                  defaultValue={actionData?.fields?.tags}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="vh-card">
              <h2>Pricing & Inventory</h2>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="price">Price *</label>
                <input
                  className="vh-input"
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={actionData?.fields?.price}
                  required
                />
              </div>

              <div className="vh-form-group">
                <label className="vh-label" htmlFor="sku">SKU</label>
                <input
                  className="vh-input"
                  type="text"
                  id="sku"
                  name="sku"
                  placeholder="Product SKU"
                  defaultValue={actionData?.fields?.sku}
                />
              </div>
            </div>

            <div className="vh-card" style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="vh-btn vh-btn-primary"
                style={{ width: "100%", padding: "12px", fontSize: 15 }}
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
