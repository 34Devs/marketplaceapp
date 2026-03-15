import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const event = await request.json();

    // In production, verify the webhook signature with PayPal
    // https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

    switch (event.event_type) {
      case "PAYMENT.PAYOUTSBATCH.SUCCESS": {
        const batchId = event.resource?.batch_header?.payout_batch_id;
        if (batchId) {
          await db.payout.updateMany({
            where: { paypalBatchId: batchId },
            data: { status: "COMPLETED", processedAt: new Date() },
          });
        }
        break;
      }

      case "PAYMENT.PAYOUTSBATCH.DENIED":
      case "PAYMENT.PAYOUTS-ITEM.FAILED": {
        const batchId =
          event.resource?.batch_header?.payout_batch_id ||
          event.resource?.payout_batch_id;
        if (batchId) {
          const payouts = await db.payout.findMany({
            where: { paypalBatchId: batchId },
          });

          for (const payout of payouts) {
            await db.payout.update({
              where: { id: payout.id },
              data: {
                status: "FAILED",
                failedAt: new Date(),
                failureReason: "PayPal payout denied or failed",
              },
            });

            // Revert commissions
            await db.commission.updateMany({
              where: { payoutId: payout.id },
              data: { payoutId: null, status: "APPROVED" },
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return json({ received: true });
};
