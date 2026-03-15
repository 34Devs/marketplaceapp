import db from "../db.server";
import { createTransfer } from "./stripe.server";
import { createPayoutBatch } from "./paypal.server";
import { createAuditLog } from "./audit.server";

export async function processPendingPayouts(shop: string) {
  const settings = await db.storeSettings.findUnique({
    where: { shop },
    select: { minimumPayoutAmount: true, currency: true },
  });

  const minAmount = settings?.minimumPayoutAmount ?? 50;
  const currency = settings?.currency ?? "USD";

  // Find all approved commissions not yet included in a payout
  const approvedCommissions = await db.commission.findMany({
    where: {
      shop,
      status: "APPROVED",
      payoutId: null,
    },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          payoutMethod: true,
          stripeConnectId: true,
          paypalEmail: true,
        },
      },
    },
  });

  // Group by vendor
  const vendorCommissions = new Map<string, typeof approvedCommissions>();
  for (const commission of approvedCommissions) {
    const existing = vendorCommissions.get(commission.vendorId) || [];
    existing.push(commission);
    vendorCommissions.set(commission.vendorId, existing);
  }

  const results: {
    vendorId: string;
    vendorName: string;
    amount: number;
    status: string;
    error?: string;
  }[] = [];

  for (const [vendorId, commissions] of vendorCommissions) {
    const vendor = commissions[0].vendor;
    const totalEarnings = commissions.reduce(
      (sum, c) => sum + c.vendorEarnings,
      0,
    );

    // Check minimum threshold
    if (totalEarnings < minAmount) {
      results.push({
        vendorId,
        vendorName: vendor.storeName,
        amount: totalEarnings,
        status: "BELOW_MINIMUM",
      });
      continue;
    }

    // Check payout method
    if (!vendor.payoutMethod) {
      results.push({
        vendorId,
        vendorName: vendor.storeName,
        amount: totalEarnings,
        status: "NO_PAYOUT_METHOD",
      });
      continue;
    }

    // Create payout record
    const payout = await db.payout.create({
      data: {
        shop,
        vendorId,
        amount: totalEarnings,
        currency,
        method: vendor.payoutMethod,
        status: "PROCESSING",
        reference: `VH-${Date.now().toString(36).toUpperCase()}`,
      },
    });

    // Link commissions to payout
    await db.commission.updateMany({
      where: {
        id: { in: commissions.map((c) => c.id) },
      },
      data: {
        payoutId: payout.id,
        status: "PAID",
      },
    });

    try {
      if (vendor.payoutMethod === "STRIPE" && vendor.stripeConnectId) {
        const transfer = await createTransfer(
          totalEarnings,
          currency,
          vendor.stripeConnectId,
          `VendorHub payout - ${vendor.storeName}`,
        );

        await db.payout.update({
          where: { id: payout.id },
          data: {
            status: "COMPLETED",
            stripeTransferId: transfer.id,
            processedAt: new Date(),
          },
        });

        results.push({
          vendorId,
          vendorName: vendor.storeName,
          amount: totalEarnings,
          status: "COMPLETED",
        });
      } else if (vendor.payoutMethod === "PAYPAL" && vendor.paypalEmail) {
        const paypalResult = await createPayoutBatch([
          {
            recipientEmail: vendor.paypalEmail,
            amount: totalEarnings,
            currency,
            note: `Marketplace payout for ${vendor.storeName}`,
            senderItemId: payout.id,
          },
        ]);

        await db.payout.update({
          where: { id: payout.id },
          data: {
            status: "PROCESSING",
            paypalBatchId: paypalResult.batchId,
          },
        });

        results.push({
          vendorId,
          vendorName: vendor.storeName,
          amount: totalEarnings,
          status: "PROCESSING",
        });
      } else {
        throw new Error("Invalid payout configuration");
      }

      await createAuditLog({
        shop,
        vendorId,
        action: "payout.processed",
        entityType: "Payout",
        entityId: payout.id,
        details: { amount: totalEarnings, method: vendor.payoutMethod },
        performedBy: "system",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await db.payout.update({
        where: { id: payout.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: errorMessage,
        },
      });

      // Revert commissions
      await db.commission.updateMany({
        where: { payoutId: payout.id },
        data: { payoutId: null, status: "APPROVED" },
      });

      results.push({
        vendorId,
        vendorName: vendor.storeName,
        amount: totalEarnings,
        status: "FAILED",
        error: errorMessage,
      });
    }
  }

  return results;
}

export async function getPayoutSummary(shop: string) {
  const [pending, processing, completed, failed] = await Promise.all([
    db.commission.aggregate({
      where: { shop, status: "APPROVED", payoutId: null },
      _sum: { vendorEarnings: true },
      _count: true,
    }),
    db.payout.aggregate({
      where: { shop, status: "PROCESSING" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payout.aggregate({
      where: { shop, status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payout.aggregate({
      where: { shop, status: "FAILED" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    pendingAmount: pending._sum.vendorEarnings ?? 0,
    pendingCount: pending._count ?? 0,
    processingAmount: processing._sum.amount ?? 0,
    processingCount: processing._count ?? 0,
    completedAmount: completed._sum.amount ?? 0,
    completedCount: completed._count ?? 0,
    failedAmount: failed._sum.amount ?? 0,
    failedCount: failed._count ?? 0,
  };
}
