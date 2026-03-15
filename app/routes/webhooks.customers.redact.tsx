import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  // GDPR: Delete customer data
  const customer = payload as any;

  if (customer?.customer?.id) {
    const shopifyCustomerId = String(customer.customer.id);

    // Remove customer email from vendor orders
    await db.vendorOrder.updateMany({
      where: {
        shop: shop!,
        customerEmail: customer.customer.email,
      },
      data: { customerEmail: null },
    });

    // Remove customer reviews
    await db.vendorReview.deleteMany({
      where: {
        shop: shop!,
        shopifyCustomerId,
      },
    });
  }

  return new Response("OK", { status: 200 });
};
