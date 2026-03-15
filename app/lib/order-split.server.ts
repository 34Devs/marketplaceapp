import db from "../db.server";
import { calculateCommissionForOrderItem } from "./commission.server";

interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: string;
  product_id: string | null;
}

interface ShopifyOrder {
  id: number;
  admin_graphql_api_id: string;
  name: string;
  email: string;
  currency: string;
  total_price: string;
  line_items: ShopifyLineItem[];
}

export async function processOrderWebhook(shop: string, order: ShopifyOrder) {
  const shopifyOrderId = order.admin_graphql_api_id;

  // Prevent duplicate processing
  const existing = await db.vendorOrder.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  });
  if (existing) return existing;

  // Look up vendor for each line item
  const lineItemsWithVendors = await Promise.all(
    order.line_items.map(async (item) => {
      if (!item.product_id) return { item, vendor: null, product: null };

      const product = await db.vendorProduct.findUnique({
        where: {
          shop_shopifyProductId: {
            shop,
            shopifyProductId: `gid://shopify/Product/${item.product_id}`,
          },
        },
        include: { vendor: true },
      });

      return { item, vendor: product?.vendor ?? null, product };
    }),
  );

  // Only process items that belong to marketplace vendors
  const vendorItems = lineItemsWithVendors.filter((li) => li.vendor !== null);

  if (vendorItems.length === 0) return null;

  // Create vendor order
  const vendorOrder = await db.vendorOrder.create({
    data: {
      shop,
      shopifyOrderId,
      shopifyOrderName: order.name,
      customerEmail: order.email,
      totalAmount: parseFloat(order.total_price),
      currency: order.currency,
      status: "PENDING",
    },
  });

  // Create vendor order items and commissions
  for (const { item, vendor, product } of vendorItems) {
    if (!vendor) continue;

    const totalAmount = parseFloat(item.price) * item.quantity;

    const orderItem = await db.vendorOrderItem.create({
      data: {
        orderId: vendorOrder.id,
        vendorId: vendor.id,
        productId: product?.id,
        shopifyLineItemId: item.id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        totalAmount,
        currency: order.currency,
        fulfillmentStatus: "UNFULFILLED",
      },
    });

    // Calculate and create commission
    const commission = await calculateCommissionForOrderItem(
      shop,
      vendor.id,
      product?.id,
      totalAmount,
    );

    await db.commission.create({
      data: {
        shop,
        vendorId: vendor.id,
        orderItemId: orderItem.id,
        orderAmount: totalAmount,
        commissionRate: commission.rate,
        commissionType: commission.type,
        commissionAmount: commission.commissionAmount,
        vendorEarnings: commission.vendorEarnings,
        currency: order.currency,
        status: "PENDING",
      },
    });
  }

  return vendorOrder;
}

export async function processOrderPaid(shop: string, shopifyOrderId: string) {
  const vendorOrder = await db.vendorOrder.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
    include: {
      items: {
        include: { commission: true },
      },
    },
  });

  if (!vendorOrder) return;

  // Update all commission statuses to APPROVED
  for (const item of vendorOrder.items) {
    if (item.commission && item.commission.status === "PENDING") {
      await db.commission.update({
        where: { id: item.commission.id },
        data: { status: "APPROVED" },
      });
    }
  }

  // Update vendor stats
  const vendorGroups = new Map<string, number>();
  for (const item of vendorOrder.items) {
    const current = vendorGroups.get(item.vendorId) ?? 0;
    vendorGroups.set(item.vendorId, current + item.totalAmount);
  }

  for (const [vendorId, amount] of vendorGroups) {
    await db.vendor.update({
      where: { id: vendorId },
      data: {
        totalSales: { increment: amount },
        totalOrders: { increment: 1 },
      },
    });
  }
}
