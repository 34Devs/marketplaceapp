import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processOrderPaid } from "../lib/order-split.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const order = payload as any;

  try {
    await processOrderPaid(shop, order.admin_graphql_api_id);
  } catch (error) {
    console.error("Error processing order paid webhook:", error);
  }

  return new Response("OK", { status: 200 });
};
