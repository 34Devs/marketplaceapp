import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_SHOP = "vendorhub-demo.myshopify.com";

async function main() {
  console.log("Seeding database...");

  // Store Settings
  const settings = await prisma.storeSettings.upsert({
    where: { shop: DEMO_SHOP },
    update: {},
    create: {
      shop: DEMO_SHOP,
      marketplaceName: "VendorHub Demo Marketplace",
      defaultCommissionRate: 10,
      defaultCommissionType: "PERCENTAGE",
      payoutSchedule: "MONTHLY",
      minimumPayoutAmount: 50,
      currency: "USD",
      autoApproveVendors: false,
      autoApproveProducts: false,
      vendorRegistrationOpen: true,
      enabledLanguages: ["en", "tr"],
    },
  });
  console.log("  Store settings created");

  // Subscription Plans
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: "plan_basic" },
    update: {},
    create: {
      id: "plan_basic",
      shop: DEMO_SHOP,
      name: "Basic",
      description: "Perfect for getting started",
      price: 9.99,
      interval: "MONTHLY",
      productLimit: 25,
      commissionRate: 12,
      features: ["Up to 25 products", "Basic analytics", "Email support"],
      sortOrder: 1,
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { id: "plan_pro" },
    update: {},
    create: {
      id: "plan_pro",
      shop: DEMO_SHOP,
      name: "Professional",
      description: "For growing businesses",
      price: 29.99,
      interval: "MONTHLY",
      productLimit: 100,
      commissionRate: 8,
      features: [
        "Up to 100 products",
        "Advanced analytics",
        "Priority support",
        "Lower commission rate",
      ],
      sortOrder: 2,
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { id: "plan_enterprise" },
    update: {},
    create: {
      id: "plan_enterprise",
      shop: DEMO_SHOP,
      name: "Enterprise",
      description: "Unlimited everything",
      price: 79.99,
      interval: "MONTHLY",
      productLimit: null,
      commissionRate: 5,
      features: [
        "Unlimited products",
        "Custom analytics",
        "Dedicated support",
        "Lowest commission rate",
        "API access",
      ],
      sortOrder: 3,
    },
  });
  console.log("  Subscription plans created");

  // Demo Vendors
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const vendor1 = await prisma.vendor.upsert({
    where: { shop_email: { shop: DEMO_SHOP, email: "alice@techgadgets.com" } },
    update: {},
    create: {
      shop: DEMO_SHOP,
      email: "alice@techgadgets.com",
      storeName: "Tech Gadgets Pro",
      slug: "tech-gadgets-pro",
      description:
        "Premium tech accessories and gadgets for the modern professional. We source the highest quality electronics from around the world.",
      phone: "+1 555-0101",
      status: "APPROVED",
      passwordHash,
      rating: 4.7,
      totalSales: 15230.5,
      totalOrders: 127,
      payoutMethod: "STRIPE",
      stripeConnectId: "acct_demo_alice",
      approvedAt: new Date("2025-01-15"),
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { shop_email: { shop: DEMO_SHOP, email: "bob@handmadegoods.com" } },
    update: {},
    create: {
      shop: DEMO_SHOP,
      email: "bob@handmadegoods.com",
      storeName: "Handmade Treasures",
      slug: "handmade-treasures",
      description:
        "Artisanal handcrafted goods made with love. Each piece is unique and tells a story.",
      phone: "+1 555-0102",
      status: "APPROVED",
      passwordHash,
      rating: 4.9,
      totalSales: 8450.0,
      totalOrders: 89,
      payoutMethod: "PAYPAL",
      paypalEmail: "bob@handmadegoods.com",
      approvedAt: new Date("2025-02-01"),
    },
  });

  const vendor3 = await prisma.vendor.upsert({
    where: { shop_email: { shop: DEMO_SHOP, email: "carol@fitnessfirst.com" } },
    update: {},
    create: {
      shop: DEMO_SHOP,
      email: "carol@fitnessfirst.com",
      storeName: "Fitness First",
      slug: "fitness-first",
      description:
        "Your one-stop shop for fitness equipment and supplements. Get fit, stay healthy!",
      status: "PENDING",
      passwordHash,
      rating: 0,
      totalSales: 0,
      totalOrders: 0,
    },
  });

  const vendor4 = await prisma.vendor.upsert({
    where: {
      shop_email: { shop: DEMO_SHOP, email: "david@vintagevinyl.com" },
    },
    update: {},
    create: {
      shop: DEMO_SHOP,
      email: "david@vintagevinyl.com",
      storeName: "Vintage Vinyl Records",
      slug: "vintage-vinyl",
      description:
        "Rare and classic vinyl records from the 60s, 70s, and 80s. Music the way it was meant to be heard.",
      status: "APPROVED",
      passwordHash,
      rating: 4.5,
      totalSales: 3200.0,
      totalOrders: 45,
      payoutMethod: "PAYPAL",
      paypalEmail: "david@vintagevinyl.com",
      approvedAt: new Date("2025-03-01"),
    },
  });
  console.log("  Demo vendors created");

  // Demo Products
  const products = [
    { vendorId: vendor1.id, title: "Wireless Charging Pad Pro", shopifyProductId: "gid://shopify/Product/1001" },
    { vendorId: vendor1.id, title: "USB-C Hub 7-in-1", shopifyProductId: "gid://shopify/Product/1002" },
    { vendorId: vendor1.id, title: "Noise Cancelling Earbuds", shopifyProductId: "gid://shopify/Product/1003" },
    { vendorId: vendor2.id, title: "Handwoven Basket Set", shopifyProductId: "gid://shopify/Product/2001" },
    { vendorId: vendor2.id, title: "Ceramic Coffee Mug - Ocean Blue", shopifyProductId: "gid://shopify/Product/2002" },
    { vendorId: vendor4.id, title: "Pink Floyd - Dark Side of the Moon (1973)", shopifyProductId: "gid://shopify/Product/4001" },
    { vendorId: vendor4.id, title: "Led Zeppelin IV (1971)", shopifyProductId: "gid://shopify/Product/4002" },
  ];

  for (const p of products) {
    await prisma.vendorProduct.upsert({
      where: { shop_shopifyProductId: { shop: DEMO_SHOP, shopifyProductId: p.shopifyProductId } },
      update: {},
      create: {
        vendorId: p.vendorId,
        shop: DEMO_SHOP,
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        status: "APPROVED",
      },
    });
  }
  console.log("  Demo products created");

  // Demo Reviews
  const reviews = [
    { vendorId: vendor1.id, customerName: "John D.", rating: 5, title: "Amazing quality!", body: "The charging pad works flawlessly. Fast delivery too!", isVerified: true },
    { vendorId: vendor1.id, customerName: "Sarah M.", rating: 4, title: "Good but pricey", body: "Great product, just a bit expensive compared to alternatives.", isVerified: true },
    { vendorId: vendor2.id, customerName: "Emily R.", rating: 5, title: "Beautiful craftsmanship", body: "The basket set is absolutely gorgeous. You can tell it was made with care.", isVerified: true },
    { vendorId: vendor2.id, customerName: "Mike P.", rating: 5, title: "Perfect gift", body: "Bought the mug for my wife, she loved it!", isVerified: false },
    { vendorId: vendor4.id, customerName: "Chris L.", rating: 4, title: "Great condition", body: "Vinyl was in excellent condition. Some minor sleeve wear but the record plays perfectly.", isVerified: true },
  ];

  for (const r of reviews) {
    await prisma.vendorReview.create({
      data: {
        shop: DEMO_SHOP,
        vendorId: r.vendorId,
        shopifyCustomerId: `customer_${Math.random().toString(36).slice(2, 8)}`,
        customerName: r.customerName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        isVerified: r.isVerified,
      },
    });
  }
  console.log("  Demo reviews created");

  // Vendor subscriptions
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.vendorSubscription.upsert({
    where: { vendorId: vendor1.id },
    update: {},
    create: {
      vendorId: vendor1.id,
      planId: proPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      currentPeriodEnd: monthEnd,
    },
  });

  await prisma.vendorSubscription.upsert({
    where: { vendorId: vendor2.id },
    update: {},
    create: {
      vendorId: vendor2.id,
      planId: basicPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      currentPeriodEnd: monthEnd,
    },
  });
  console.log("  Vendor subscriptions created");

  console.log("\nSeed complete! Demo login credentials:");
  console.log("  Email: alice@techgadgets.com  Password: demo1234");
  console.log("  Email: bob@handmadegoods.com  Password: demo1234");
  console.log("  Email: carol@fitnessfirst.com Password: demo1234 (pending)");
  console.log("  Email: david@vintagevinyl.com Password: demo1234");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
