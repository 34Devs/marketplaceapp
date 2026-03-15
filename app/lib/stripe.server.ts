import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  return stripe;
}

export async function createConnectedAccount(email: string, country: string = "US") {
  const s = requireStripe();
  const account = await s.accounts.create({
    type: "express",
    email,
    country,
    capabilities: {
      transfers: { requested: true },
    },
  });
  return account;
}

export async function createAccountOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
) {
  const s = requireStripe();
  const link = await s.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function createTransfer(
  amount: number,
  currency: string,
  destinationAccountId: string,
  description?: string,
) {
  const s = requireStripe();
  const transfer = await s.transfers.create({
    amount: Math.round(amount * 100), // Stripe uses cents
    currency: currency.toLowerCase(),
    destination: destinationAccountId,
    description,
  });
  return transfer;
}

export async function getAccountStatus(accountId: string) {
  const s = requireStripe();
  const account = await s.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export { stripe };
