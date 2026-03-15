import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  if (!shop) return new Response("OK", { status: 200 });

  // GDPR: Delete ALL store data 48 hours after uninstall
  // Order matters due to foreign key constraints
  try {
    await db.auditLog.deleteMany({ where: { shop } });
    await db.message.deleteMany({ where: { shop } });
    await db.vendorReview.deleteMany({ where: { shop } });
    await db.commission.deleteMany({ where: { shop } });
    await db.vendorOrderItem.deleteMany({
      where: { order: { shop } },
    });
    await db.vendorOrder.deleteMany({ where: { shop } });
    await db.payout.deleteMany({ where: { shop } });
    await db.vendorProduct.deleteMany({ where: { shop } });
    await db.subscriptionPayment.deleteMany({
      where: { subscription: { vendor: { shop } } },
    });
    await db.vendorSubscription.deleteMany({
      where: { vendor: { shop } },
    });
    await db.subscriptionPlan.deleteMany({ where: { shop } });
    await db.vendor.deleteMany({ where: { shop } });
    await db.storeSettings.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });

    console.log(`Shop data redacted for: ${shop}`);
  } catch (error) {
    console.error(`Error redacting shop data for ${shop}:`, error);
  }

  return new Response("OK", { status: 200 });
};
