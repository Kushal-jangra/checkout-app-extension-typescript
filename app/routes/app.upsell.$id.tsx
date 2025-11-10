// ...existing code...
import { useState, useEffect } from "react";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  useParams,
  useNavigate,
} from "react-router";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/server-runtime";
import { authenticate } from "../shopify.server";
import {
  createUpsellGroup,
  getUpsellGroup,
  updateUpsellGroup,
  deleteUpsellGroup,
  validateUpsellGroup,
} from "../models/Upsell.server";
// ...existing code...

declare global {
  interface Window {
    shopify?: {
      resourcePicker?: (opts: {
        type: string;
        action?: string;
        multiple?: boolean;
      }) => Promise<any[]>;
      saveBar?: {
        show?: (id: string) => void;
        hide?: (id: string) => void;
      };
    };
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      title: "",
      products: [],
    });
  }

  const group = await getUpsellGroup(Number(params.id), session.shop, admin);

  if (!group) {
    return redirect("/app/upsells");
  }

  return json(group);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const actionField = formData.get("action");

  if (actionField === "delete") {
    await deleteUpsellGroup(Number(params.id), shop);
    return redirect("/app/upsells");
  }

  const data = {
    title: (formData.get("title") as string) || "",
    productIds: (formData.getAll("productIds[]") as string[]) || [],
  };

  const errors = validateUpsellGroup(data);

  if (errors) {
    return json({ errors }, { status: 422 });
  }

  let group;
  if (params.id === "new") {
    group = await createUpsellGroup(shop, data.title, data.productIds);
  } else {
    group = await updateUpsellGroup(Number(params.id), shop, data);
  }

  return redirect(`/app/upsell/${group.id}`);
};

// --- Component ---
type UpsellActionData = { errors?: Record<string, string> };

export default function UpsellForm() {
  type Product = {
    id: string;
    title: string;
    handle?: string;
    imageUrl?: string;
  };

  type UpsellGroup = {
    title: string;
    products: Product[];
  };

  const group = (useLoaderData<typeof loader>() ?? { title: "", products: [] }) as UpsellGroup;
  const actionData = useActionData<UpsellActionData>();
  const errors = actionData?.errors || {};

  const { id } = useParams();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isSaving = navigation.state === "submitting";

  const [initialState, setInitialState] = useState<UpsellGroup>(() => group);
  const [formState, setFormState] = useState<UpsellGroup>(() => group);

  const isDirty = JSON.stringify(formState) !== JSON.stringify(initialState);

  useEffect(() => {
    setInitialState(group);
    setFormState(group);
  }, [group]);

  useEffect(() => {
    const shopify = (window as any).shopify;
    if (isDirty) {
      shopify?.saveBar?.show?.("upsell-form");
    } else {
      shopify?.saveBar?.hide?.("upsell-form");
    }
    return () => shopify?.saveBar?.hide?.("upsell-form");
  }, [isDirty]);

  async function handleSelectProducts() {
    if (!window.shopify?.resourcePicker) return;

    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: true,
    });

    if (products && products.length > 0) {
      const selectedProducts = products.map((product: any) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        imageUrl: product.images?.[0]?.originalSrc || product.images?.[0]?.src,
      }));

      setFormState((s: any) => ({
        ...s,
        products: selectedProducts,
      }));
    }
  }

  function handleRemoveProduct(productId: string) {
    setFormState((s: any) => ({
      ...s,
      products: (s.products || []).filter(
        (product: any) => product.id !== productId
      ),
    }));
  }

  function handleSaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSave();
  }

  function handleSave() {
    const fd = new FormData();
    fd.append("title", formState.title || "");
    (formState.products || []).forEach((product: any) =>
      fd.append("productIds[]", product.id)
    );
    submit(fd, { method: "post" });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.append("action", "delete");
    submit(fd, { method: "post" });
  }

  function handleReset() {
    setFormState(initialState);
  }

  return (
    <>
      <form data-save-bar onSubmit={handleSaveSubmit} onReset={handleReset}>
        <s-page heading={initialState?.title || "Create Upsell Group"}>
          <s-link
            href="/app/upsells"
            slot="breadcrumb-actions"
            onClick={(e: any) =>
              isDirty ? e.preventDefault() : navigate("/app/upsells")
            }
          >
            Upsell Groups
          </s-link>

          {id !== "new" && (
            <s-button
              slot="secondary-actions"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete
            </s-button>
          )}

          <s-section heading="Group Details">
            <s-stack gap="base">
              <s-text-field
                label="Group Title"
                details="This name is for your reference."
                error={errors.title}
                autocomplete="off"
                name="title"
                value={formState.title}
                onInput={(e: any) =>
                  setFormState({ ...formState, title: e.target.value })
                }
              ></s-text-field>
            </s-stack>
          </s-section>

          <s-section heading="Products">
            <s-stack gap="base">
              <s-button onClick={handleSelectProducts}>
                {(formState.products || []).length > 0
                  ? "Change Products"
                  : "Select Products"}
              </s-button>

              {errors.products && (
                <s-text color="base">
                  {errors.products}
                </s-text>
              )}

              {(formState.products || []).length > 0 && (
                <s-stack gap="small-400">
                  {(formState.products || []).map((product: any) => (
                    <s-stack
                      key={product.id}
                      direction="inline"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <s-stack
                        direction="inline"
                        gap="small-100"
                        alignItems="center"
                      >
                        <s-box
                          padding="small-200"
                          border="base"
                          borderRadius="base"
                          background="subdued"
                          inlineSize="38px"
                          blockSize="38px"
                        >
                          {product.imageUrl ? (
                            <s-image src={product.imageUrl}></s-image>
                          ) : (
                            <s-icon size="small" type="product" />
                          )}
                        </s-box>
                        <s-text>{product.title}</s-text>
                      </s-stack>
                      <s-button
                        onClick={() => handleRemoveProduct(product.id)}
                        variant="tertiary"
                        tone="neutral"
                        disabled={isSaving}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  ))}
                </s-stack>
              )}
            </s-stack>
          </s-section>
        </s-page>
      </form>
    </>
  );
}
// ...existing code...