import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processOrderWebhook } from "../lib/order-split.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  try {
    await processOrderWebhook(shop, payload as any);
  } catch (error) {
    console.error("Error processing order webhook:", error);
  }

  return new Response("OK", { status: 200 });
};
