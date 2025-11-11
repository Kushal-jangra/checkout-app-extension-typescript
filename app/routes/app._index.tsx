import { useEffect } from "react";
import type { FC } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary, Session } from "@shopify/shopify-app-react-router/server";
import { getUpsellGroups } from "app/models/Upsell.server";
import type { EnrichedUpsellGroup } from "app/models/Upsell.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const upsellGroups = await getUpsellGroups(session.shop , admin);
  return { upsellGroups };
};

const EmptyQRCodeState = () => (
  <s-section accessibilityLabel="Empty state section">
    <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
      <s-box maxInlineSize="200px" maxBlockSize="200px">
        <s-image
          aspectRatio="1/0.5"
          src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          alt="A stylized graphic of a document"
        />
      </s-box>
      <s-grid justifyItems="center" maxBlockSize="450px" maxInlineSize="450px">
        <s-heading>Create new Upsell Groups</s-heading>
        <s-paragraph>
              Get started by creating your first upsell group to offer products at checkout 
        </s-paragraph>
        <s-stack
          gap="small-200"
          justifyContent="center"
          padding="base"
          paddingBlockEnd="none"
          direction="inline"
        >
          <s-button href="/app/upsell/new" variant="primary">
            Create New Group
          </s-button>
        </s-stack>
      </s-grid>
    </s-grid>
  </s-section>
);
function truncate(str: string | null | undefined, { length = 25 }: { length?: number } = {}): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const UpsellGroupTableRow: FC<{ upsellGroup: EnrichedUpsellGroup }> = ({
  upsellGroup,
}) => {
  // Use the first product's image as the thumbnail
  const firstProduct = upsellGroup.products[0];
  const productCount = upsellGroup.products.length;

  return (
    <s-table-row id={String(upsellGroup.id)}>
      {/* --- Title Cell --- */}
      <s-table-cell>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-clickable
            href={`/app/upsell/${upsellGroup.id}`}
            accessibilityLabel={`Edit group ${upsellGroup.title}`}
            border="base"
            borderRadius="base"
            overflow="hidden"
            inlineSize="20px"
            blockSize="20px"
          >
            {firstProduct?.imageUrl ? (
              <s-image
                objectFit="cover"
                src={firstProduct.imageUrl}
              ></s-image>
            ) : (
              <s-icon size="small" type="product" /> // Fallback icon
            )}
          </s-clickable>
          <s-link
            href={`/app/upsell/${upsellGroup.id}`}
          >
            <s-link>{truncate(upsellGroup.title)}</s-link>
          </s-link>
        </s-stack>
      </s-table-cell>

      {/* --- Products Cell --- */}
      <s-table-cell>
        {productCount === 0 ? (
          <s-badge icon="alert-diamond" tone="critical">
            No products
          </s-badge>
        ) : (
          `${productCount} product${productCount > 1 ? "s" : ""}`
        )}
      </s-table-cell>

      {/* --- Date Created Cell --- */}
      <s-table-cell>
        {new Date(upsellGroup.createdAt).toDateString()}
      </s-table-cell>
    </s-table-row>
  );
};


const UpsellGroupsTable: FC<{ upsellGroups: EnrichedUpsellGroup[] }> = ({ upsellGroups }) => (
  <s-section padding="none" accessibilityLabel="Upsell groups table section">
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Title</s-table-header>
        <s-table-header>Product</s-table-header>
        <s-table-header>Date created</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {upsellGroups.map((upsellGroup) => (
          <UpsellGroupTableRow key={upsellGroup.id} upsellGroup={upsellGroup} />
        ))}
      </s-table-body>
    </s-table>
  </s-section>
);




export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  console.log("action happened")
  return null; 
};

export default function Index() {
  const { upsellGroups } = useLoaderData();

  return (
    <s-page heading="Upsell Groups">
      <s-link slot="secondary-actions" href="/app/upsell/new">
        Create new Group
      </s-link>
      {upsellGroups.length === 0 ? (
        <EmptyQRCodeState />
      ) : (
        <UpsellGroupsTable upsellGroups={upsellGroups} />
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
