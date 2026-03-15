import type { CommissionType } from "@prisma/client";
import db from "../db.server";

interface CommissionResult {
  rate: number;
  type: CommissionType;
  commissionAmount: number;
  vendorEarnings: number;
}

export function calculateCommission(
  orderAmount: number,
  rate: number,
  type: CommissionType,
): { commissionAmount: number; vendorEarnings: number } {
  let commissionAmount: number;

  if (type === "PERCENTAGE") {
    commissionAmount = (orderAmount * rate) / 100;
  } else {
    commissionAmount = Math.min(rate, orderAmount);
  }

  commissionAmount = Math.round(commissionAmount * 100) / 100;
  const vendorEarnings = Math.round((orderAmount - commissionAmount) * 100) / 100;

  return { commissionAmount, vendorEarnings };
}

export async function getEffectiveRate(
  shop: string,
  vendorId: string,
  productId?: string,
): Promise<{ rate: number; type: CommissionType }> {
  // Priority: Product override > Vendor override > Plan override > Store default

  // 1. Check product-level override
  if (productId) {
    const product = await db.vendorProduct.findUnique({
      where: { id: productId },
      select: { commissionRate: true },
    });
    if (product?.commissionRate != null) {
      return { rate: product.commissionRate, type: "PERCENTAGE" };
    }
  }

  // 2. Check vendor-level override
  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: {
      commissionRate: true,
      commissionType: true,
      subscription: {
        select: {
          plan: {
            select: { commissionRate: true },
          },
        },
      },
    },
  });

  if (vendor?.commissionRate != null) {
    return {
      rate: vendor.commissionRate,
      type: vendor.commissionType ?? "PERCENTAGE",
    };
  }

  // 3. Check subscription plan override
  if (vendor?.subscription?.plan?.commissionRate != null) {
    return {
      rate: vendor.subscription.plan.commissionRate,
      type: "PERCENTAGE",
    };
  }

  // 4. Fall back to store default
  const storeSettings = await db.storeSettings.findUnique({
    where: { shop },
    select: {
      defaultCommissionRate: true,
      defaultCommissionType: true,
    },
  });

  return {
    rate: storeSettings?.defaultCommissionRate ?? 10,
    type: storeSettings?.defaultCommissionType ?? "PERCENTAGE",
  };
}

export async function calculateCommissionForOrderItem(
  shop: string,
  vendorId: string,
  productId: string | undefined,
  orderAmount: number,
): Promise<CommissionResult> {
  const { rate, type } = await getEffectiveRate(shop, vendorId, productId);
  const { commissionAmount, vendorEarnings } = calculateCommission(
    orderAmount,
    rate,
    type,
  );

  return { rate, type, commissionAmount, vendorEarnings };
}
