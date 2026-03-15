import db from "../db.server";
import { createAuditLog } from "./audit.server";

interface ProductInput {
  title: string;
  descriptionHtml?: string;
  productType?: string;
  tags?: string[];
  variants?: {
    price: string;
    sku?: string;
    inventoryQuantities?: {
      availableQuantity: number;
      locationId: string;
    }[];
  }[];
  images?: { src: string; altText?: string }[];
}

export async function createProductInShopify(
  admin: any,
  shop: string,
  vendorId: string,
  input: ProductInput,
) {
  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, storeName: true, slug: true },
  });

  if (!vendor) throw new Error("Vendor not found");

  // Check store settings for auto-approve
  const settings = await db.storeSettings.findUnique({
    where: { shop },
    select: { autoApproveProducts: true },
  });

  const response = await admin.graphql(
    `#graphql
    mutation productCreate($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          status
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        product: {
          title: input.title,
          descriptionHtml: input.descriptionHtml || "",
          productType: input.productType || "",
          tags: input.tags || [],
          status: settings?.autoApproveProducts ? "ACTIVE" : "DRAFT",
        },
      },
    },
  );

  const responseJson = await response.json();
  const productData = responseJson.data?.productCreate?.product;
  const errors = responseJson.data?.productCreate?.userErrors;

  if (errors?.length > 0) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }

  if (!productData) {
    throw new Error("Failed to create product in Shopify");
  }

  // Set vendor metafields on the product
  await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: productData.id,
            namespace: "$app:vendor",
            key: "vendor_id",
            type: "single_line_text_field",
            value: vendor.id,
          },
          {
            ownerId: productData.id,
            namespace: "$app:vendor",
            key: "vendor_name",
            type: "single_line_text_field",
            value: vendor.storeName,
          },
          {
            ownerId: productData.id,
            namespace: "$app:vendor",
            key: "vendor_slug",
            type: "single_line_text_field",
            value: vendor.slug,
          },
        ],
      },
    },
  );

  // Set price on variant if provided
  if (input.variants?.[0]?.price) {
    const variantId = productData.variants.edges[0]?.node?.id;
    if (variantId) {
      await admin.graphql(
        `#graphql
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            productId: productData.id,
            variants: [
              {
                id: variantId,
                price: input.variants[0].price,
                ...(input.variants[0].sku ? { sku: input.variants[0].sku } : {}),
              },
            ],
          },
        },
      );
    }
  }

  // Create vendor product record
  const vendorProduct = await db.vendorProduct.create({
    data: {
      vendorId: vendor.id,
      shop,
      shopifyProductId: productData.id,
      shopifyProductHandle: productData.handle,
      title: productData.title,
      status: settings?.autoApproveProducts ? "APPROVED" : "PENDING",
    },
  });

  await createAuditLog({
    shop,
    vendorId: vendor.id,
    action: "product.created",
    entityType: "VendorProduct",
    entityId: vendorProduct.id,
    details: { title: productData.title, shopifyProductId: productData.id },
    performedBy: vendor.id,
  });

  return vendorProduct;
}

export async function updateProductInShopify(
  admin: any,
  shop: string,
  vendorProductId: string,
  input: Partial<ProductInput>,
) {
  const vendorProduct = await db.vendorProduct.findUnique({
    where: { id: vendorProductId },
    include: { vendor: true },
  });

  if (!vendorProduct) throw new Error("Vendor product not found");

  const response = await admin.graphql(
    `#graphql
    mutation productUpdate($product: ProductInput!) {
      productUpdate(product: $product) {
        product {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        product: {
          id: vendorProduct.shopifyProductId,
          title: input.title,
          descriptionHtml: input.descriptionHtml,
          productType: input.productType,
          tags: input.tags,
        },
      },
    },
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.productUpdate?.userErrors;

  if (errors?.length > 0) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }

  const updatedProduct = responseJson.data?.productUpdate?.product;

  await db.vendorProduct.update({
    where: { id: vendorProductId },
    data: {
      title: updatedProduct?.title || vendorProduct.title,
      shopifyProductHandle: updatedProduct?.handle,
    },
  });

  return vendorProduct;
}

export async function deleteProductFromShopify(
  admin: any,
  shop: string,
  vendorProductId: string,
) {
  const vendorProduct = await db.vendorProduct.findUnique({
    where: { id: vendorProductId },
  });

  if (!vendorProduct) throw new Error("Vendor product not found");

  await admin.graphql(
    `#graphql
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: { id: vendorProduct.shopifyProductId },
      },
    },
  );

  await db.vendorProduct.update({
    where: { id: vendorProductId },
    data: { status: "ARCHIVED" },
  });

  await createAuditLog({
    shop,
    vendorId: vendorProduct.vendorId,
    action: "product.deleted",
    entityType: "VendorProduct",
    entityId: vendorProductId,
    details: { title: vendorProduct.title },
    performedBy: vendorProduct.vendorId,
  });
}
