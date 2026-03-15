import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = await request.text();
  const sigHeader = request.headers.get("stripe-signature");

  if (!sigHeader) {
    return json({ error: "Missing signature" }, { status: 400 });
  }

  // In production, verify the webhook signature with Stripe
  // const event = stripe.webhooks.constructEvent(payload, sigHeader, webhookSecret);

  try {
    const event = JSON.parse(payload);

    switch (event.type) {
      case "transfer.created":
      case "transfer.updated": {
        const transfer = event.data.object;
        const payout = await db.payout.findFirst({
          where: { stripeTransferId: transfer.id },
        });
        if (payout) {
          const status = transfer.reversed
            ? "FAILED"
            : transfer.destination_payment
              ? "COMPLETED"
              : "PROCESSING";
          await db.payout.update({
            where: { id: payout.id },
            data: {
              status,
              processedAt: status === "COMPLETED" ? new Date() : undefined,
            },
          });
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        // Update vendor's Stripe connect status if needed
        const vendor = await db.vendor.findFirst({
          where: { stripeConnectId: account.id },
        });
        if (vendor && account.details_submitted) {
          // Stripe onboarding complete
          console.log(`Stripe onboarding complete for vendor ${vendor.id}`);
        }
        break;
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return json({ received: true });
};
