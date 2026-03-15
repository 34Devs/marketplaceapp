const PAYPAL_BASE_URL = process.env.NODE_ENV === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

interface PayoutItem {
  recipientEmail: string;
  amount: number;
  currency: string;
  note?: string;
  senderItemId: string;
}

export async function createPayoutBatch(
  items: PayoutItem[],
  emailSubject: string = "You have a payout from VendorHub",
) {
  const accessToken = await getAccessToken();
  const batchId = `VH_${Date.now()}`;

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: emailSubject,
        email_message: "You have received a payout from the marketplace.",
      },
      items: items.map((item) => ({
        recipient_type: "EMAIL",
        amount: {
          value: item.amount.toFixed(2),
          currency: item.currency,
        },
        receiver: item.recipientEmail,
        note: item.note || "Marketplace payout",
        sender_item_id: item.senderItemId,
      })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`PayPal payout failed: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return {
    batchId: data.batch_header.payout_batch_id,
    batchStatus: data.batch_header.batch_status,
  };
}

export async function getPayoutBatchStatus(batchId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/payments/payouts/${batchId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(`PayPal status check failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    batchStatus: data.batch_header.batch_status,
    items: data.items?.map((item: any) => ({
      itemId: item.payout_item_id,
      senderItemId: item.payout_item.sender_item_id,
      status: item.transaction_status,
      amount: item.payout_item.amount.value,
    })),
  };
}
