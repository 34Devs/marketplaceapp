import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import db from "../db.server";

const reviewSchema = z.object({
  vendorId: z.string().min(1),
  shopifyCustomerId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const vendorId = url.searchParams.get("vendorId");
  const shop = url.searchParams.get("shop");

  if (!vendorId || !shop) {
    return json({ reviews: [] });
  }

  const reviews = await db.vendorReview.findMany({
    where: { vendorId, shop, isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      customerName: true,
      rating: true,
      title: true,
      body: true,
      isVerified: true,
      reply: true,
      repliedAt: true,
      createdAt: true,
    },
  });

  return json({ reviews });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  const rawData = {
    vendorId: formData.get("vendorId") as string,
    shopifyCustomerId: formData.get("shopifyCustomerId") as string,
    customerName: formData.get("customerName") as string,
    customerEmail: (formData.get("customerEmail") as string) || undefined,
    rating: parseInt(formData.get("rating") as string, 10),
    title: (formData.get("title") as string) || undefined,
    body: (formData.get("body") as string) || undefined,
  };

  const result = reviewSchema.safeParse(rawData);
  if (!result.success) {
    return json({ error: "Invalid review data" }, { status: 400 });
  }

  // Check if customer has purchased from vendor (verified review)
  const hasPurchased = await db.vendorOrderItem.findFirst({
    where: {
      vendorId: result.data.vendorId,
      order: { customerEmail: result.data.customerEmail },
    },
  });

  const review = await db.vendorReview.create({
    data: {
      shop,
      vendorId: result.data.vendorId,
      shopifyCustomerId: result.data.shopifyCustomerId,
      customerName: result.data.customerName,
      customerEmail: result.data.customerEmail,
      rating: result.data.rating,
      title: result.data.title,
      body: result.data.body,
      isVerified: !!hasPurchased,
    },
  });

  // Update vendor average rating
  const ratingStats = await db.vendorReview.aggregate({
    where: { vendorId: result.data.vendorId, isPublished: true },
    _avg: { rating: true },
  });

  await db.vendor.update({
    where: { id: result.data.vendorId },
    data: { rating: ratingStats._avg.rating ?? 0 },
  });

  return json({ success: true, review });
};
