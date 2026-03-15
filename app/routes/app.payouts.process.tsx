import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processPendingPayouts } from "../lib/payout.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const results = await processPendingPayouts(session.shop);
    return json({ success: true, results });
  } catch (error) {
    console.error("Payout processing error:", error);
    return json(
      { success: false, error: "Failed to process payouts" },
      { status: 500 },
    );
  }
};
