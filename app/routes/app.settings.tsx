import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Checkbox,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await db.storeSettings.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await db.storeSettings.upsert({
    where: { shop: session.shop },
    update: {
      marketplaceName: formData.get("marketplaceName") as string,
      defaultCommissionRate: parseFloat(formData.get("defaultCommissionRate") as string) || 10,
      defaultCommissionType: (formData.get("defaultCommissionType") as any) || "PERCENTAGE",
      payoutSchedule: (formData.get("payoutSchedule") as any) || "MONTHLY",
      minimumPayoutAmount: parseFloat(formData.get("minimumPayoutAmount") as string) || 50,
      currency: (formData.get("currency") as string) || "USD",
      autoApproveVendors: formData.get("autoApproveVendors") === "true",
      autoApproveProducts: formData.get("autoApproveProducts") === "true",
      vendorRegistrationOpen: formData.get("vendorRegistrationOpen") === "true",
    },
    create: {
      shop: session.shop,
      marketplaceName: formData.get("marketplaceName") as string,
    },
  });

  return json({ success: true });
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [, setSaved] = useState(false);

  const [formState, setFormState] = useState({
    marketplaceName: settings.marketplaceName,
    defaultCommissionRate: String(settings.defaultCommissionRate),
    defaultCommissionType: settings.defaultCommissionType,
    payoutSchedule: settings.payoutSchedule,
    minimumPayoutAmount: String(settings.minimumPayoutAmount),
    currency: settings.currency,
    autoApproveVendors: settings.autoApproveVendors,
    autoApproveProducts: settings.autoApproveProducts,
    vendorRegistrationOpen: settings.vendorRegistrationOpen,
  });

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("marketplaceName", formState.marketplaceName);
    formData.set("defaultCommissionRate", formState.defaultCommissionRate);
    formData.set("defaultCommissionType", formState.defaultCommissionType);
    formData.set("payoutSchedule", formState.payoutSchedule);
    formData.set("minimumPayoutAmount", formState.minimumPayoutAmount);
    formData.set("currency", formState.currency);
    formData.set("autoApproveVendors", String(formState.autoApproveVendors));
    formData.set("autoApproveProducts", String(formState.autoApproveProducts));
    formData.set("vendorRegistrationOpen", String(formState.vendorRegistrationOpen));
    submit(formData, { method: "post" });
    setSaved(true);
    shopify.toast.show("Settings saved");
    setTimeout(() => setSaved(false), 3000);
  }, [formState, submit, shopify]);

  return (
    <Page>
      <TitleBar title="Marketplace Settings" />
      <Layout>
        <Layout.AnnotatedSection
          title="General"
          description="Configure your marketplace basics."
        >
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Marketplace Name"
                value={formState.marketplaceName}
                onChange={(v) => setFormState((s) => ({ ...s, marketplaceName: v }))}
                autoComplete="off"
              />
              <Select
                label="Currency"
                options={[
                  { label: "USD", value: "USD" },
                  { label: "EUR", value: "EUR" },
                  { label: "GBP", value: "GBP" },
                  { label: "TRY", value: "TRY" },
                ]}
                value={formState.currency}
                onChange={(v) => setFormState((s) => ({ ...s, currency: v }))}
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Commissions"
          description="Set default commission rates for vendors."
        >
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Default Commission Rate"
                type="number"
                value={formState.defaultCommissionRate}
                onChange={(v) => setFormState((s) => ({ ...s, defaultCommissionRate: v }))}
                suffix={formState.defaultCommissionType === "PERCENTAGE" ? "%" : "fixed"}
                autoComplete="off"
              />
              <Select
                label="Commission Type"
                options={[
                  { label: "Percentage", value: "PERCENTAGE" },
                  { label: "Fixed Amount", value: "FIXED" },
                ]}
                value={formState.defaultCommissionType}
                onChange={(v) => setFormState((s) => ({ ...s, defaultCommissionType: v as typeof s.defaultCommissionType }))}
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Payouts"
          description="Configure payout schedule and thresholds."
        >
          <Card>
            <BlockStack gap="400">
              <Select
                label="Payout Schedule"
                options={[
                  { label: "Daily", value: "DAILY" },
                  { label: "Weekly", value: "WEEKLY" },
                  { label: "Bi-weekly", value: "BIWEEKLY" },
                  { label: "Monthly", value: "MONTHLY" },
                ]}
                value={formState.payoutSchedule}
                onChange={(v) => setFormState((s) => ({ ...s, payoutSchedule: v as typeof s.payoutSchedule }))}
              />
              <TextField
                label="Minimum Payout Amount"
                type="number"
                value={formState.minimumPayoutAmount}
                onChange={(v) => setFormState((s) => ({ ...s, minimumPayoutAmount: v }))}
                prefix="$"
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Vendor Registration"
          description="Control how vendors join your marketplace."
        >
          <Card>
            <BlockStack gap="400">
              <Checkbox
                label="Allow vendor registration"
                checked={formState.vendorRegistrationOpen}
                onChange={(v) => setFormState((s) => ({ ...s, vendorRegistrationOpen: v }))}
              />
              <Checkbox
                label="Auto-approve new vendors"
                checked={formState.autoApproveVendors}
                onChange={(v) => setFormState((s) => ({ ...s, autoApproveVendors: v }))}
              />
              <Checkbox
                label="Auto-approve new products"
                checked={formState.autoApproveProducts}
                onChange={(v) => setFormState((s) => ({ ...s, autoApproveProducts: v }))}
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.Section>
          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave}>
              Save Settings
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
