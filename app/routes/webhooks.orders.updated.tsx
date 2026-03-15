import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const order = payload as any;
  const shopifyOrderId = order.admin_graphql_api_id;

  try {
    const vendorOrder = await db.vendorOrder.findUnique({
      where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
    });

    if (!vendorOrder) return new Response("OK", { status: 200 });

    // Update order status based on financial/fulfillment status
    let status = vendorOrder.status;
    if (order.cancelled_at) {
      status = "CANCELLED";
    } else if (order.financial_status === "refunded") {
      status = "REFUNDED";
    } else if (order.fulfillment_status === "fulfilled") {
      status = "FULFILLED";
    } else if (order.fulfillment_status === "partial") {
      status = "PARTIALLY_FULFILLED";
    }

    if (status !== vendorOrder.status) {
      await db.vendorOrder.update({
        where: { id: vendorOrder.id },
        data: { status: status as any },
      });

      // If cancelled/refunded, update commission statuses
      if (status === "CANCELLED" || status === "REFUNDED") {
        await db.commission.updateMany({
          where: {
            orderItem: { orderId: vendorOrder.id },
            status: { in: ["PENDING", "APPROVED"] },
          },
          data: { status: status === "CANCELLED" ? "CANCELLED" : "REFUNDED" },
        });
      }
    }
  } catch (error) {
    console.error("Error processing order update webhook:", error);
  }

  return new Response("OK", { status: 200 });
};
