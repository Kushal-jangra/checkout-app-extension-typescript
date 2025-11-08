import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  console.log("action happened")
  return null; 
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const submitHandler = () => {
    fetcher.submit(null , {method : "post"})
  }

  const shopify = useAppBridge();

  return (
    <s-page heading="Shopify app template">
      <s-section heading="Congrats on creating a new Shopify app 🎉">
        <s-button onClick={() => submitHandler()}>Click me</s-button>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
