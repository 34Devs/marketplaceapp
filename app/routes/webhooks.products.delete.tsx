import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const product = payload as any;
  const shopifyProductId = `gid://shopify/Product/${product.id}`;

  try {
    const vendorProduct = await db.vendorProduct.findUnique({
      where: { shop_shopifyProductId: { shop, shopifyProductId } },
    });

    if (vendorProduct) {
      await db.vendorProduct.update({
        where: { id: vendorProduct.id },
        data: { status: "ARCHIVED" },
      });
    }
  } catch (error) {
    console.error("Error processing product delete webhook:", error);
  }

  return new Response("OK", { status: 200 });
};
