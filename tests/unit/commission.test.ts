import { describe, it, expect } from "vitest";
import { calculateCommission } from "../../app/lib/commission.server";

describe("calculateCommission", () => {
  it("calculates percentage commission correctly", () => {
    const result = calculateCommission(100, 10, "PERCENTAGE");
    expect(result.commissionAmount).toBe(10);
    expect(result.vendorEarnings).toBe(90);
  });

  it("calculates fixed commission correctly", () => {
    const result = calculateCommission(100, 5, "FIXED");
    expect(result.commissionAmount).toBe(5);
    expect(result.vendorEarnings).toBe(95);
  });

  it("handles zero order amount", () => {
    const result = calculateCommission(0, 10, "PERCENTAGE");
    expect(result.commissionAmount).toBe(0);
    expect(result.vendorEarnings).toBe(0);
  });

  it("fixed commission does not exceed order amount", () => {
    const result = calculateCommission(3, 5, "FIXED");
    expect(result.commissionAmount).toBe(3);
    expect(result.vendorEarnings).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateCommission(99.99, 15, "PERCENTAGE");
    expect(result.commissionAmount).toBe(15);
    expect(result.vendorEarnings).toBe(84.99);
  });

  it("handles 100% commission", () => {
    const result = calculateCommission(50, 100, "PERCENTAGE");
    expect(result.commissionAmount).toBe(50);
    expect(result.vendorEarnings).toBe(0);
  });

  it("handles 0% commission", () => {
    const result = calculateCommission(100, 0, "PERCENTAGE");
    expect(result.commissionAmount).toBe(0);
    expect(result.vendorEarnings).toBe(100);
  });

  it("handles large amounts", () => {
    const result = calculateCommission(10000, 12.5, "PERCENTAGE");
    expect(result.commissionAmount).toBe(1250);
    expect(result.vendorEarnings).toBe(8750);
  });
});
