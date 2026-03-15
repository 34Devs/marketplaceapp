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
  Box,
  InlineStack,
  Badge,
  DataTable,
  Link,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Ensure store settings exist
  await db.storeSettings.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });

  const [
    totalVendors,
    pendingVendors,
    approvedVendors,
    totalProducts,
    totalOrders,
    pendingPayouts,
    recentVendors,
    commissionStats,
  ] = await Promise.all([
    db.vendor.count({ where: { shop } }),
    db.vendor.count({ where: { shop, status: "PENDING" } }),
    db.vendor.count({ where: { shop, status: "APPROVED" } }),
    db.vendorProduct.count({ where: { shop } }),
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
        createdAt: true,
      },
    }),
    db.commission.aggregate({
      where: { shop, status: "APPROVED" },
      _sum: { commissionAmount: true, vendorEarnings: true },
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
    totalProducts,
    totalOrders,
    pendingPayouts,
    totalRevenue,
    totalCommissionEarned,
    recentVendors,
  });
};

function StatCard({
  title,
  value,
  suffix,
}: {
  title: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <InlineStack align="start" blockAlign="baseline" gap="100">
          <Text as="p" variant="headingXl" fontWeight="bold">
            {value}
          </Text>
          {suffix && (
            <Text as="p" variant="bodyMd" tone="subdued">
              {suffix}
            </Text>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

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
  const {
    totalVendors,
    pendingVendors,
    approvedVendors,
    totalProducts,
    totalOrders,
    pendingPayouts,
    totalRevenue,
    totalCommissionEarned,
    recentVendors,
  } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const recentVendorRows = recentVendors.map((vendor) => [
    <Link key={vendor.id} url={`/app/vendors/${vendor.id}`} removeUnderline>
      {vendor.storeName}
    </Link>,
    vendor.email,
    statusBadge(vendor.status),
    formatCurrency(vendor.totalSales),
    new Date(vendor.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="VendorHub - Marketplace Dashboard" />
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard title="Total Vendors" value={totalVendors} />
          <StatCard title="Pending Approvals" value={pendingVendors} />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
          />
          <StatCard
            title="Commission Earned"
            value={formatCurrency(totalCommissionEarned)}
          />
        </InlineGrid>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard title="Active Vendors" value={approvedVendors} />
          <StatCard title="Total Products" value={totalProducts} />
          <StatCard title="Total Orders" value={totalOrders} />
          <StatCard title="Pending Payouts" value={pendingPayouts} />
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent Vendors
                </Text>
                {recentVendors.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "numeric",
                      "text",
                    ]}
                    headings={[
                      "Store Name",
                      "Email",
                      "Status",
                      "Total Sales",
                      "Joined",
                    ]}
                    rows={recentVendorRows}
                  />
                ) : (
                  <Box padding="400">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                      No vendors yet. Share your vendor registration link to get
                      started!
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
