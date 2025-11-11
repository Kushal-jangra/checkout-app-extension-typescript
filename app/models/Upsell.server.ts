/*
 * This file (upsell.server.ts) will manage all your app's logic
 * for creating and retrieving "Upsell Groups."
 */

// --- Imports ---

/*
 * 1. DATABASE IMPORT:
 * Just like your QR code file, you need to import your Prisma database client
 * to save and get your upsell group data.
 */
import db from "../db.server";

/*
 * 2. SHOPIFY API IMPORT (for getting product data):
 * This is your authenticated "phone line" to the Shopify Admin API.
 * We'll use this to fetch product details (like titles, images, and prices)
 * to display in your app. The `admin` object gives you both a
 * `graphql` and `rest` client.
 *
 * (The path "../shopify.server" is standard in the Remix app template.
 * If you're not using Remix, you'd get this from your app's context.)
 */
// We only import the admin *type* here, not the admin object itself.
// Define a minimal AdminApiContext locally to avoid requiring the shopify package's types.
type AdminApiContext = {
  graphql: (
    query: string,
    opts?: { variables?: Record<string, any> }
  ) => Promise<{ json: () => Promise<any> }>;
};

/*
 * 3. TYPESCRIPT TYPES (for type safety - optional but recommended):
 * When you run `npx prisma generate`, Prisma creates types for you.
 * Importing your `UpsellGroup` type helps TypeScript catch errors.
 * You would need to define `model UpsellGroup` in your `schema.prisma` file.
 */
// import type { UpsellGroup } from "@prisma/client";

/*
 * 4. UTILITY IMPORT (for safety checks):
 * Same as your QR code file, this is great for ensuring data is correct.
 */
import invariant from "tiny-invariant";

// --- Types (Good Practice) ---

// A type for the raw data as it's stored in our database
// This helps us fix the "implicit any" error.
type UpsellGroupFromDB = {
  id: number;
  title: string;
  shop: string;
  productIds: string;
  createdAt: Date;
};

// A type to describe the product data we fetch and want to use
type ProductData = {
  id: string; // e.g., "gid://shopify/Product/12345"
  title: string;
  imageUrl?: string;
  handle: string;
};

// A type for your "enriched" upsell group, combining your
// database data with the live product data from Shopify.
export type EnrichedUpsellGroup = {
  id: number;
  title: string;
  shop: string;
  createdAt: Date;
  // This will be the list of full product objects
  products: ProductData[];
};

// --- Public Functions ---

/**
 * Validates the data for creating/updating an upsell group.
 * This is just like your `validateQRCode` function.
 */
export function validateUpsellGroup(data: {
  title: string;
  productIds: string[];
}) {
  const errors: { title?: string; products?: string } = {};

  if (!data.title) {
    errors.title = "Title is required";
  }

  if (!data.productIds || data.productIds.length === 0) {
    errors.products = "At least one product is required";
  }

  if (Object.keys(errors).length) {
    return errors;
  }
}

/**
 * Creates a new upsell group in your app's database.
 * @param shop - The shop's domain (e.g., "my-store.myshopify.com")
 * @param title - The name for the group (e.g., "Summer Sale Upsells")
 * @param productIds - An array of Shopify Product GIDs
 * (e.g., ["gid://shopify/Product/123", "gid://shopify/Product/456"])
 */
export async function createUpsellGroup(
  shop: string,
  title: string,
  productIds: string[]
) {
  invariant(title, "Title is required");
  invariant(productIds && productIds.length > 0, "Products are required");

  // This is the data we will save in *our* database.
  // We just save the product IDs, not the full product details.
  const dataToSave = {
    shop,
    title,
    // Note: Prisma can't always store string arrays in SQLite easily.
    // A common pattern is to store them as a single JSON string.
    productIds: JSON.stringify(productIds),
  };

  /*
   * This is the Prisma command to save your group.
   * You'd need to add this model to your `schema.prisma` file:
   *
   * model UpsellGroup {
   * id        Int      @id @default(autoincrement())
   * title     String
   * shop      String
   * productIds String // Stored as a JSON string
   * createdAt DateTime @default(now())
   *
   * @@index([shop])
   * }
   */
  const newGroup = await (db as any).upsellGroup.create({
    data: dataToSave,
  });

  return newGroup;
}

/**
 * Gets a single upsell group by its ID and enriches it
 * with live product data from Shopify.
 */
export async function getUpsellGroup(
  id: number,
  shop: string,
  adminClient: AdminApiContext // <-- We now require the authenticated client
): Promise<EnrichedUpsellGroup | null> {
  const group = await (db as any).upsellGroup.findFirst({
    where: { id, shop },
  });

  if (!group) {
    return null;
  }

  // Once we have our group, we "supplement" it, just like in your QR code app
  return supplementUpsellGroup(group, adminClient);
}

/**
 * Gets all upsell groups for a shop and enriches them.
 */
export async function getUpsellGroups(
  shop: string,
  adminClient: AdminApiContext // <-- We now require the authenticated client
): Promise<EnrichedUpsellGroup[]> {
  const groups = await (db as any).upsellGroup.findMany({
    where: { shop },
    orderBy: { id: "desc" },
  });

  if (!groups.length) {
    return [];
  }
  return Promise.all(
    groups.map((group: UpsellGroupFromDB) =>
      supplementUpsellGroup(group, adminClient)
    )
  );
}

/**
 * Updates an existing upsell group in your app's database.
 * @param id - The ID of the group to update
 * @param shop - The shop's domain (for security)
 * @param data - An object with title and/or productIds
 */
export async function updateUpsellGroup(
  id: number,
  shop: string,
  data: {
    title: string;
    productIds: string[];
  }
) {
  invariant(data.title, "Title is required");
  invariant(
    data.productIds && data.productIds.length > 0,
    "Products are required"
  );

  // Use updateMany for safety, ensuring the ID and shop both match
  await (db as any).upsellGroup.updateMany({
    where: { id, shop },
    data: {
      title: data.title,
      productIds: JSON.stringify(data.productIds),
    },
  });

  const updatedGroup = await (db as any).upsellGroup.findFirst({ where: { id, shop } });
  return updatedGroup;
}

/**
 * Deletes an upsell group from your app's database.
 * @param id - The ID of the group to delete
 * @param shop - The shop's domain (for security)
 */
export async function deleteUpsellGroup(id: number, shop: string) {
  // Use deleteMany for safety, ensuring the ID and shop both match
  await (db as any).upsellGroup.deleteMany({
    where: { id, shop },
  });

  return {success: true};
}

// --- Internal Helper Function ---

/**
 * Enriches a basic UpsellGroup from our DB with live product
 * data from the Shopify Admin API.
 *
 * This is the exact same *pattern* as `supplementQRCode`.
 */
async function supplementUpsellGroup(
  group: UpsellGroupFromDB,
  adminClient: AdminApiContext // <-- We accept the client as an argument
): Promise<EnrichedUpsellGroup> {
  try {
    // 1. We no longer need to get the client, we already have it!
    // const { admin: shopifyAdmin } = await admin.admin.api.getByShop(group.shop); // <-- DELETED

    // 2. Parse the product IDs from our database
    const productIds: string[] = JSON.parse(group.productIds);

    // 3. Call the Shopify Admin API (GraphQL) to get product data
    // This is more efficient than fetching one by one.
    // The `nodes(ids: $ids)` query lets us fetch many products at once.
    const response = await adminClient.graphql( // <-- Use the passed-in client
      `
        query getProductNodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
              featuredImage {
                url
              }
            }
          }
        }
      `,
      {
        variables: {
          ids: productIds,
        },
      }
    );

    const responseJson = await response.json();
    const productNodes = responseJson.data.nodes || [];

    // 4. Format the product data
    const products: ProductData[] = productNodes
      .filter((node: any) => node !== null) // Filter out any deleted products
      .map((node: any) => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        imageUrl: node.featuredImage?.url,
      }));

    // 5. Return the "enriched" object
    return {
      id: group.id,
      title: group.title,
      shop: group.shop,
      createdAt: group.createdAt,
      products: products, // The live product data
    };
  } catch (error) {
    console.error("Failed to supplement upsell group:", error);
    // Return the basic group data if the Shopify API call fails
    return {
      id: group.id,
      title: group.title,
      shop: group.shop,
      createdAt: group.createdAt,
      products: [], // Return an empty array on error
    };
  }
}

/**
 * A function to get a list of products from Shopify
 * This is what you would use for your "Product Picker" UI.
 */
export async function searchProducts(
  shop: string,
  query: string,
  adminClient: AdminApiContext // <-- We now require the authenticated client
): Promise<ProductData[]> {
  // 1. We no longer need to get the client, we already have it!
  // const { admin: shopifyAdmin } = await admin.admin.api.getByShop(shop); // <-- DELETED

  // Use the Admin API to search for products
  const response = await adminClient.graphql( // <-- Use the passed-in client
    `
      query searchProducts($query: String!) {
        products(first: 10, query: $query) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
            }
          }
        }
      }
    `,
    {
      variables: {
        query: `title:*${query}*`, // Basic title search
      },
    }
  );

  const responseJson = await response.json();
  const productNodes = responseJson.data.products.nodes || [];

  const products: ProductData[] = productNodes.map((node: any) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    imageUrl: node.featuredImage?.url,
  }));

  return products;
}