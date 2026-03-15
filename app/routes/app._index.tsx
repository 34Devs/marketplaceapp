import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  InlineGrid,
  InlineStack,
  Badge,
  DataTable,
  Link,
  ProgressBar,
  Button,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await db.storeSettings.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });

  const [
    totalVendors,
    pendingVendors,
    approvedVendors,
    suspendedVendors,
    totalProducts,
    approvedProducts,
    pendingProducts,
    totalOrders,
    pendingPayouts,
    recentVendors,
    commissionStats,
    topVendors,
  ] = await Promise.all([
    db.vendor.count({ where: { shop } }),
    db.vendor.count({ where: { shop, status: "PENDING" } }),
    db.vendor.count({ where: { shop, status: "APPROVED" } }),
    db.vendor.count({ where: { shop, status: "SUSPENDED" } }),
    db.vendorProduct.count({ where: { shop } }),
    db.vendorProduct.count({ where: { shop, status: "APPROVED" } }),
    db.vendorProduct.count({ where: { shop, status: "PENDING" } }),
    db.vendorOrder.count({ where: { shop } }),
    db.payout.count({ where: { shop, status: "PENDING" } }),
    db.vendor.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        storeName: true,
        email: true,
        status: true,
        totalSales: true,
        totalOrders: true,
        rating: true,
        createdAt: true,
      },
    }),
    db.commission.aggregate({
      where: { shop, status: "APPROVED" },
      _sum: { commissionAmount: true, vendorEarnings: true },
    }),
    db.vendor.findMany({
      where: { shop, status: "APPROVED" },
      orderBy: { totalSales: "desc" },
      take: 5,
      select: {
        id: true,
        storeName: true,
        totalSales: true,
        totalOrders: true,
        rating: true,
      },
    }),
  ]);

  const totalRevenue =
    (commissionStats._sum.commissionAmount ?? 0) +
    (commissionStats._sum.vendorEarnings ?? 0);
  const totalCommissionEarned = commissionStats._sum.commissionAmount ?? 0;

  return json({
    totalVendors,
    pendingVendors,
    approvedVendors,
    suspendedVendors,
    totalProducts,
    approvedProducts,
    pendingProducts,
    totalOrders,
    pendingPayouts,
    totalRevenue,
    totalCommissionEarned,
    recentVendors,
    topVendors,
  });
};

function statusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return <Badge tone="success">Approved</Badge>;
    case "PENDING":
      return <Badge tone="attention">Pending</Badge>;
    case "SUSPENDED":
      return <Badge tone="critical">Suspended</Badge>;
    case "REJECTED":
      return <Badge tone="critical">Rejected</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();

  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const vendorRate =
    data.totalVendors > 0
      ? Math.round((data.approvedVendors / data.totalVendors) * 100)
      : 0;

  const productRate =
    data.totalProducts > 0
      ? Math.round((data.approvedProducts / data.totalProducts) * 100)
      : 0;

  const recentVendorRows = data.recentVendors.map((v) => [
    <Link key={v.id} url={`/app/vendors/${v.id}`} removeUnderline>
      {v.storeName}
    </Link>,
    v.email,
    statusBadge(v.status),
    v.rating > 0 ? v.rating.toFixed(1) : "-",
    fmt(v.totalSales),
    new Date(v.createdAt).toLocaleDateString(),
  ]);

  const topVendorRows = data.topVendors.map((v) => [
    <Link key={v.id} url={`/app/vendors/${v.id}`} removeUnderline>
      {v.storeName}
    </Link>,
    fmt(v.totalSales),
    String(v.totalOrders),
    v.rating > 0 ? v.rating.toFixed(1) : "-",
  ]);

  return (
    <Page title="VendorHub Dashboard">
      <BlockStack gap="500">

        {/* Alerts */}
        {(data.pendingVendors > 0 || data.pendingProducts > 0) && (
          <Card>
            <BlockStack gap="300">
              {data.pendingVendors > 0 && (
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <Badge tone="attention">{String(data.pendingVendors)}</Badge>
                    {" "}vendor{data.pendingVendors > 1 ? "s" : ""} awaiting approval
                  </Text>
                  <Button url="/app/vendors" size="slim">Review</Button>
                </InlineStack>
              )}
              {data.pendingProducts > 0 && (
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <Badge tone="info">{String(data.pendingProducts)}</Badge>
                    {" "}product{data.pendingProducts > 1 ? "s" : ""} awaiting approval
                  </Text>
                  <Button url="/app/products" size="slim">Review</Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        )}

        {/* Revenue Row */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Total Revenue</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{fmt(data.totalRevenue)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Commission Earned</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{fmt(data.totalCommissionEarned)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Total Orders</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.totalOrders}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Pending Payouts</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.pendingPayouts}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Vendor/Product Row */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Total Vendors</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.totalVendors}</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.approvedVendors} active, {data.pendingVendors} pending
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Total Products</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.totalProducts}</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.approvedProducts} approved, {data.pendingProducts} pending
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Active Vendors</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.approvedVendors}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Suspended</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{data.suspendedVendors}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Approval Rates */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Vendor Approval Rate</Text>
              <InlineStack align="space-between">
                <Text as="p" variant="headingLg">{vendorRate}%</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {data.approvedVendors} / {data.totalVendors}
                </Text>
              </InlineStack>
              <ProgressBar progress={vendorRate} tone="primary" size="small" />
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Product Approval Rate</Text>
              <InlineStack align="space-between">
                <Text as="p" variant="headingLg">{productRate}%</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {data.approvedProducts} / {data.totalProducts}
                </Text>
              </InlineStack>
              <ProgressBar progress={productRate} tone="primary" size="small" />
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Recent Vendors */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Recent Vendors</Text>
              <Button url="/app/vendors" variant="plain">View all</Button>
            </InlineStack>
            {data.recentVendors.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "numeric", "text"]}
                headings={["Store", "Email", "Status", "Rating", "Sales", "Joined"]}
                rows={recentVendorRows}
              />
            ) : (
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                No vendors yet. Share your vendor registration link to get started!
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Top Vendors */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Top Vendors by Sales</Text>
              <Button url="/app/vendors" variant="plain">View all</Button>
            </InlineStack>
            {data.topVendors.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "text"]}
                headings={["Vendor", "Sales", "Orders", "Rating"]}
                rows={topVendorRows}
              />
            ) : (
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                No vendor data yet.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Quick Actions</Text>
            <InlineStack gap="300" wrap>
              <Button url="/app/vendors">Manage Vendors</Button>
              <Button url="/app/products">Review Products</Button>
              <Button url="/app/commissions">Commissions</Button>
              <Button url="/app/payouts">Payouts</Button>
              <Button url="/app/analytics">Analytics</Button>
              <Button url="/app/settings">Settings</Button>
            </InlineStack>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
