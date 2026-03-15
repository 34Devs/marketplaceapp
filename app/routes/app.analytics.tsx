import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineGrid,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    vendorStats,
    topVendors,
    revenueStats,
    orderStats,
  ] = await Promise.all([
    db.vendor.groupBy({
      by: ["status"],
      where: { shop },
      _count: true,
    }),
    db.vendor.findMany({
      where: { shop, status: "APPROVED" },
      orderBy: { totalSales: "desc" },
      take: 10,
      select: {
        storeName: true,
        totalSales: true,
        totalOrders: true,
        rating: true,
        _count: { select: { products: true } },
      },
    }),
    db.commission.aggregate({
      where: { shop },
      _sum: {
        orderAmount: true,
        commissionAmount: true,
        vendorEarnings: true,
      },
      _count: true,
    }),
    db.vendorOrder.aggregate({
      where: { shop },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  return json({
    vendorStats,
    topVendors,
    totalRevenue: revenueStats._sum.orderAmount ?? 0,
    totalCommission: revenueStats._sum.commissionAmount ?? 0,
    totalVendorEarnings: revenueStats._sum.vendorEarnings ?? 0,
    totalOrders: orderStats._count ?? 0,
    totalOrderAmount: orderStats._sum.totalAmount ?? 0,
  });
};

export default function AnalyticsPage() {
  const {
    vendorStats,
    topVendors,
    totalRevenue,
    totalCommission,
    totalVendorEarnings,
    totalOrders,
  } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const vendorStatusMap = Object.fromEntries(
    vendorStats.map((s) => [s.status, s._count]),
  );

  const topVendorRows = topVendors.map((v) => [
    v.storeName,
    formatCurrency(v.totalSales),
    v.totalOrders,
    v._count.products,
    v.rating > 0 ? `${v.rating.toFixed(1)}/5` : "N/A",
  ]);

  return (
    <Page>
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Revenue</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{formatCurrency(totalRevenue)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Your Commission</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{formatCurrency(totalCommission)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Vendor Earnings</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{formatCurrency(totalVendorEarnings)}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Total Orders</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{totalOrders}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Approved Vendors</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{vendorStatusMap.APPROVED ?? 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Pending Vendors</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{vendorStatusMap.PENDING ?? 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Suspended Vendors</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{vendorStatusMap.SUSPENDED ?? 0}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">Rejected Vendors</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">{vendorStatusMap.REJECTED ?? 0}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Top Vendors by Sales</Text>
                {topVendors.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric", "numeric", "text"]}
                    headings={["Vendor", "Total Sales", "Orders", "Products", "Rating"]}
                    rows={topVendorRows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No vendor data yet.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
