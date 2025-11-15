// On your backend: e.g., app/routes/api/upsells.ts (Remix example)
import { data, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server"; // Your auth utility
import  db from "../../db.server"; // Your Prisma client instance

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Verify the session token from the extension
  // The `authenticate.public.checkout` method handles JWT verification
  const checkoutResult = await authenticate.public.checkout(request);
  const { session } = (checkoutResult as any).session;
  const { cors } = (checkoutResult as any).cors;

  if (!session) {
    // If the token is invalid or missing, deny access
    return cors(data({ error: "Unauthorized" }, { status: 401 }));
  }

  // 2. Token is valid, now you can safely query your database
  try {
    const upsellProducts = await db.product.findFirst({
      where: {
        // Your logic to find the specific upsell products
        id : 1,
      },
    });

    // 3. Return the data as JSON
    return cors(data(upsellProducts));

  } catch (error) {
    console.error("Failed to fetch upsell:", error);
    return cors(data({ error: "Internal Server Error" }, { status: 500 }));
  }
}