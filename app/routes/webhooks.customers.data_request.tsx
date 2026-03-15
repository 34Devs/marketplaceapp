import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  // GDPR: Return customer data on request
  // In production, this should gather all vendor-related data for the customer
  console.log(`Customer data request received for shop: ${shop}`);

  return new Response("OK", { status: 200 });
};
