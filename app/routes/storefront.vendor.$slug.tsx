import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const slug = params.slug;

  if (!slug || !shop) {
    return new Response(renderPage("Vendor Not Found", "<p>Vendor not found.</p>"), {
      headers: { "Content-Type": "application/liquid" },
    });
  }

  const vendor = await db.vendor.findFirst({
    where: { shop, slug, status: "APPROVED" },
    select: {
      storeName: true,
      slug: true,
      description: true,
      rating: true,
      totalSales: true,
      totalOrders: true,
      createdAt: true,
      products: {
        where: { status: "APPROVED" },
        select: {
          shopifyProductId: true,
          title: true,
        },
      },
      reviewsReceived: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          customerName: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!vendor) {
    return new Response(renderPage("Vendor Not Found", "<p>This vendor could not be found.</p>"), {
      headers: { "Content-Type": "application/liquid" },
    });
  }

  const joinedDate = new Date(vendor.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  const starsHtml = renderStars(vendor.rating);

  const productsHtml = vendor.products.length > 0
    ? `<div class="vh-products-grid">
        ${vendor.products.map((p) => {
          return `<div class="vh-product-card">
            <a href="/products/${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}" class="vh-product-link">
              <div class="vh-product-title">${escapeHtml(p.title)}</div>
            </a>
          </div>`;
        }).join("")}
      </div>`
    : `<p class="vh-empty">No products listed yet.</p>`;

  const reviewsHtml = vendor.reviewsReceived.length > 0
    ? `<div class="vh-reviews">
        ${vendor.reviewsReceived.map((r) => `
          <div class="vh-review-card">
            <div class="vh-review-header">
              <strong>${escapeHtml(r.customerName)}</strong>
              <span class="vh-review-stars">${renderStars(r.rating)}</span>
            </div>
            ${r.title ? `<div class="vh-review-title">${escapeHtml(r.title)}</div>` : ""}
            ${r.body ? `<p class="vh-review-body">${escapeHtml(r.body)}</p>` : ""}
            <div class="vh-review-date">${new Date(r.createdAt).toLocaleDateString()}</div>
          </div>
        `).join("")}
      </div>`
    : `<p class="vh-empty">No reviews yet.</p>`;

  const html = `
    <div class="vh-vendor-page">
      <div class="vh-vendor-header">
        <div class="vh-vendor-avatar">${vendor.storeName.charAt(0)}</div>
        <div class="vh-vendor-info">
          <h1 class="vh-vendor-name">${escapeHtml(vendor.storeName)}</h1>
          <div class="vh-vendor-meta">
            ${starsHtml}
            <span class="vh-meta-sep">|</span>
            <span>${vendor.products.length} products</span>
            <span class="vh-meta-sep">|</span>
            <span>Joined ${joinedDate}</span>
          </div>
        </div>
      </div>

      ${vendor.description ? `<div class="vh-vendor-description"><p>${escapeHtml(vendor.description)}</p></div>` : ""}

      <div class="vh-section">
        <h2 class="vh-section-title">Products</h2>
        ${productsHtml}
      </div>

      <div class="vh-section">
        <h2 class="vh-section-title">Reviews (${vendor.reviewsReceived.length})</h2>
        ${reviewsHtml}
      </div>
    </div>
  `;

  return new Response(renderPage(vendor.storeName, html), {
    headers: { "Content-Type": "application/liquid" },
  });
};

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStars(rating: number) {
  if (rating <= 0) return '<span class="vh-stars">No ratings</span>';
  const full = Math.floor(rating);
  let html = '<span class="vh-stars">';
  for (let i = 0; i < 5; i++) {
    html += i < full
      ? '<span class="vh-star vh-star-filled">&#9733;</span>'
      : '<span class="vh-star">&#9733;</span>';
  }
  html += ` <span class="vh-rating-num">${rating.toFixed(1)}</span></span>`;
  return html;
}

function renderPage(title: string, body: string) {
  return `
<style>
  .vh-vendor-page { max-width: 900px; margin: 40px auto; padding: 0 20px; font-family: inherit; }
  .vh-vendor-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .vh-vendor-avatar {
    width: 64px; height: 64px; border-radius: 50%; background: #5c2dbc;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 28px; flex-shrink: 0;
  }
  .vh-vendor-name { margin: 0; font-size: 28px; }
  .vh-vendor-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #6d7175; font-size: 14px; margin-top: 4px; }
  .vh-meta-sep { color: #c9cccf; }
  .vh-vendor-description { background: #f6f6f7; border-radius: 10px; padding: 16px 20px; margin-bottom: 32px; }
  .vh-vendor-description p { margin: 0; line-height: 1.6; color: #333; }

  .vh-section { margin-bottom: 40px; }
  .vh-section-title { font-size: 20px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e1e3e5; }

  .vh-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .vh-product-card { border: 1px solid #e1e3e5; border-radius: 10px; padding: 16px; transition: box-shadow 0.2s; }
  .vh-product-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .vh-product-link { text-decoration: none; color: inherit; }
  .vh-product-title { font-weight: 600; font-size: 14px; }

  .vh-reviews { display: flex; flex-direction: column; gap: 16px; }
  .vh-review-card { border: 1px solid #e1e3e5; border-radius: 10px; padding: 16px; }
  .vh-review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .vh-review-title { font-weight: 600; margin-bottom: 4px; }
  .vh-review-body { margin: 0; color: #333; line-height: 1.5; }
  .vh-review-date { font-size: 12px; color: #6d7175; margin-top: 8px; }

  .vh-stars { color: #c9cccf; }
  .vh-star-filled { color: #b5a000; }
  .vh-rating-num { font-size: 13px; color: #6d7175; margin-left: 4px; }
  .vh-empty { color: #6d7175; text-align: center; padding: 20px 0; }
</style>

<div>
  <h1 style="display:none;">{{ page_title }}</h1>
  ${body}
</div>
`;
}
