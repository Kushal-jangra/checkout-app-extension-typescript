import '@shopify/ui-extensions/preact';
import {render} from "preact";
import { useEffect, useState } from 'preact/hooks';

// 1. Export the extension
export default async () => {
  render(<Extension />, document.body)
};

function Extension() {
  const [productAdded, setProductAdded] = useState([]);
    const {sessionToken} = shopify;

  useEffect(() => {
    async function queryApi() {
      // Request a new (or cached) session token from Shopify
      const token =
        await shopify.sessionToken.get();
      console.log('sessionToken.get()', token);

      const apiResponse =
        await fetchWithToken(token);
      // Use your response
      console.log('API response', apiResponse);
    }

    async function fetchWithToken(token) {
      const result = await fetch("https://jews-arrived-viruses-always.trycloudflare.com/api/upsell",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if(!result.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await result.json();
      setProductAdded(data);
    }

    queryApi();
  }, [sessionToken]);
  // // 2. Check instructions for feature availability, see https://shopify.dev/docs/api/checkout-ui-extensions/apis/cart-instructions for details


  // 3. Render a UI
  return (
    <s-banner heading="You can also Buy" tone="info">
      <s-text>This product has a free gift available! {productAdded.length > 0 ? "Yes" : "No"}</s-text>
      <s-button onClick={handleClick}>Add Free Gift</s-button>
    </s-banner>
  );

  async function handleClick() {
    // 4. Call the API to modify checkout
    const result = await shopify.applyAttributeChange({
      key: "requestedFreeGift",
      type: "updateAttribute",
      value: "yes",
    });
    console.log("applyAttributeChange result", result);
  }
}
