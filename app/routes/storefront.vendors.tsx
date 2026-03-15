import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  if (!shop) {
    return new Response(renderPage("Vendors", "<p>Shop not found.</p>"), {
      headers: { "Content-Type": "application/liquid" },
    });
  }

  const vendors = await db.vendor.findMany({
    where: { shop, status: "APPROVED" },
    orderBy: { totalSales: "desc" },
    select: {
      storeName: true,
      slug: true,
      description: true,
      rating: true,
      _count: { select: { products: true } },
    },
  });

  const vendorCards = vendors.length > 0
    ? vendors.map((v) => `
        <a href="/apps/vendorhub/vendor/${v.slug}" class="vh-vendor-card">
          <div class="vh-card-avatar">${v.storeName.charAt(0)}</div>
          <div class="vh-card-content">
            <div class="vh-card-name">${escapeHtml(v.storeName)}</div>
            ${v.description
              ? `<p class="vh-card-desc">${escapeHtml(v.description.substring(0, 120))}${v.description.length > 120 ? "..." : ""}</p>`
              : ""}
            <div class="vh-card-meta">
              ${v._count.products} product${v._count.products !== 1 ? "s" : ""}
              ${v.rating > 0 ? ` · ${v.rating.toFixed(1)} &#9733;` : ""}
            </div>
          </div>
        </a>
      `).join("")
    : `<p class="vh-empty">No vendors available yet.</p>`;

  const html = `
    <div class="vh-vendors-page">
      <h1 class="vh-page-title">Our Vendors</h1>
      <p class="vh-page-subtitle">Browse products from our marketplace vendors</p>
      <div class="vh-vendors-grid">
        ${vendorCards}
      </div>
    </div>
  `;

  return new Response(renderPage("Our Vendors", html), {
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

function renderPage(title: string, body: string) {
  return `
<style>
  .vh-vendors-page { max-width: 1000px; margin: 40px auto; padding: 0 20px; font-family: inherit; }
  .vh-page-title { font-size: 32px; text-align: center; margin-bottom: 8px; }
  .vh-page-subtitle { text-align: center; color: #6d7175; margin-bottom: 32px; font-size: 16px; }

  .vh-vendors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }
  .vh-vendor-card {
    display: flex; gap: 14px; padding: 20px;
    border: 1px solid #e1e3e5; border-radius: 12px;
    text-decoration: none; color: inherit;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .vh-vendor-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    transform: translateY(-2px);
  }
  .vh-card-avatar {
    width: 48px; height: 48px; border-radius: 50%; background: #5c2dbc;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 20px; flex-shrink: 0;
  }
  .vh-card-content { flex: 1; min-width: 0; }
  .vh-card-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
  .vh-card-desc {
    font-size: 13px; color: #6d7175; margin: 0 0 8px;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .vh-card-meta { font-size: 12px; color: #8c9196; }
  .vh-empty { text-align: center; color: #6d7175; padding: 40px 0; grid-column: 1 / -1; }
</style>

<div>
  <h1 style="display:none;">{{ page_title }}</h1>
  ${body}
</div>
`;
}
