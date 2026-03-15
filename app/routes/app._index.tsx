import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link as RemixLink } from "@remix-run/react";
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
  Divider,
  Banner,
  ProgressBar,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

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
    recentOrders,
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
    db.vendorOrder.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        shopifyOrderId: true,
        shopifyOrderName: true,
        totalAmount: true,
        createdAt: true,
        items: {
          take: 1,
          select: { vendor: { select: { storeName: true } } },
        },
      },
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
    recentOrders,
    topVendors,
  });
};

function StatCard({
  title,
  value,
  trendLabel,
}: {
  title: string;
  value: string | number;
  trendLabel?: string;
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="p" variant="bodyMd" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingXl" fontWeight="bold">
          {value}
        </Text>
        {trendLabel && (
          <Text as="p" variant="bodySm" tone="subdued">
            {trendLabel}
          </Text>
        )}
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

function formatRating(rating: number) {
  if (rating <= 0) return "-";
  return rating.toFixed(1) + " / 5.0";
}

export default function Dashboard() {
  const {
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
    recentOrders,
    topVendors,
  } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const vendorApprovalRate =
    totalVendors > 0 ? Math.round((approvedVendors / totalVendors) * 100) : 0;

  const productApprovalRate =
    totalProducts > 0
      ? Math.round((approvedProducts / totalProducts) * 100)
      : 0;

  const recentVendorRows = recentVendors.map((vendor) => [
    <Link key={vendor.id} url={`/app/vendors/${vendor.id}`} removeUnderline>
      {vendor.storeName}
    </Link>,
    vendor.email,
    statusBadge(vendor.status),
    formatRating(vendor.rating),
    formatCurrency(vendor.totalSales),
    new Date(vendor.createdAt).toLocaleDateString(),
  ]);

  const topVendorRows = topVendors.map((vendor) => [
    <Link key={vendor.id} url={`/app/vendors/${vendor.id}`} removeUnderline>
      {vendor.storeName}
    </Link>,
    formatCurrency(vendor.totalSales),
    String(vendor.totalOrders),
    formatRating(vendor.rating),
  ]);

  const recentOrderRows = recentOrders.map((order) => [
    order.shopifyOrderName || order.shopifyOrderId,
    order.items[0]?.vendor?.storeName || "-",
    formatCurrency(Number(order.totalAmount)),
    new Date(order.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="VendorHub Dashboard" />
      <BlockStack gap="500">
        {/* Pending alerts */}
        {pendingVendors > 0 && (
          <Banner
            title={`${pendingVendors} vendor${pendingVendors > 1 ? "s" : ""} awaiting approval`}
            tone="warning"
            action={{ content: "Review vendors", url: "/app/vendors" }}
          />
        )}
        {pendingProducts > 0 && (
          <Banner
            title={`${pendingProducts} product${pendingProducts > 1 ? "s" : ""} awaiting approval`}
            tone="info"
            action={{ content: "Review products", url: "/app/products" }}
          />
        )}

        {/* Revenue Stats */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
          />
          <StatCard
            title="Commission Earned"
            value={formatCurrency(totalCommissionEarned)}
          />
          <StatCard title="Total Orders" value={totalOrders} />
          <StatCard title="Pending Payouts" value={pendingPayouts} />
        </InlineGrid>

        {/* Vendor & Product Stats */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard
            title="Total Vendors"
            value={totalVendors}
            trendLabel={`${approvedVendors} active, ${pendingVendors} pending`}
          />
          <StatCard
            title="Total Products"
            value={totalProducts}
            trendLabel={`${approvedProducts} approved, ${pendingProducts} pending`}
          />
          <StatCard title="Active Vendors" value={approvedVendors} />
          <StatCard title="Suspended" value={suspendedVendors} />
        </InlineGrid>

        {/* Approval Rates */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Vendor Approval Rate
              </Text>
              <InlineStack align="space-between">
                <Text as="p" variant="headingLg">
                  {vendorApprovalRate}%
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {approvedVendors} / {totalVendors} vendors
                </Text>
              </InlineStack>
              <ProgressBar
                progress={vendorApprovalRate}
                tone="primary"
                size="small"
              />
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Product Approval Rate
              </Text>
              <InlineStack align="space-between">
                <Text as="p" variant="headingLg">
                  {productApprovalRate}%
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {approvedProducts} / {totalProducts} products
                </Text>
              </InlineStack>
              <ProgressBar
                progress={productApprovalRate}
                tone="primary"
                size="small"
              />
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Recent Vendors Table */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Recent Vendors
                  </Text>
                  <Link url="/app/vendors" removeUnderline>
                    View all
                  </Link>
                </InlineStack>
                <Divider />
                {recentVendors.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
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
                      "Rating",
                      "Total Sales",
                      "Joined",
                    ]}
                    rows={recentVendorRows}
                  />
                ) : (
                  <Box padding="400">
                    <Text
                      as="p"
                      variant="bodyMd"
                      tone="subdued"
                      alignment="center"
                    >
                      No vendors yet. Share your vendor registration link to get
                      started!
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Top Vendors & Recent Orders side by side */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Top Vendors
                </Text>
                <Link url="/app/vendors" removeUnderline>
                  View all
                </Link>
              </InlineStack>
              <Divider />
              {topVendors.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "text"]}
                  headings={["Vendor", "Sales", "Orders", "Rating"]}
                  rows={topVendorRows}
                />
              ) : (
                <Box padding="400">
                  <Text
                    as="p"
                    variant="bodyMd"
                    tone="subdued"
                    alignment="center"
                  >
                    No vendor data yet.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Recent Orders
                </Text>
                <Link url="/app/orders" removeUnderline>
                  View all
                </Link>
              </InlineStack>
              <Divider />
              {recentOrders.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text"]}
                  headings={["Order", "Vendor", "Amount", "Date"]}
                  rows={recentOrderRows}
                />
              ) : (
                <Box padding="400">
                  <Text
                    as="p"
                    variant="bodyMd"
                    tone="subdued"
                    alignment="center"
                  >
                    No orders yet.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Quick Actions
            </Text>
            <Divider />
            <InlineStack gap="300" wrap>
              <Button url="/app/vendors">Manage Vendors</Button>
              <Button url="/app/products">Review Products</Button>
              <Button url="/app/commissions">View Commissions</Button>
              <Button url="/app/payouts">Payouts</Button>
              <Button url="/app/settings">Settings</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
