import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ vendors: [] });
  }

  const vendors = await db.vendor.findMany({
    where: { shop, status: "APPROVED" },
    orderBy: { totalSales: "desc" },
    select: {
      slug: true,
      storeName: true,
      description: true,
      logo: true,
      rating: true,
      _count: { select: { products: true } },
    },
  });

  return json({
    vendors: vendors.map((v) => ({
      slug: v.slug,
      storeName: v.storeName,
      description: v.description,
      logo: v.logo,
      rating: v.rating,
      productCount: v._count.products,
    })),
  });
};
