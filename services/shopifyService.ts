import { ShopifyProduct, ShopifyOrder, ShopifyCollection, ShopifyPage } from '../types';

// REVERTED: This service now uses environment variables as Shopify Admin API cannot be called from the browser due to CORS.
const shopifyFetch = async (query: string, variables?: object) => {
    // These environment variables would typically be set in the deployment environment (e.g., Cloud Run, Vercel).
    // They are not accessible on the client-side unless specifically exposed, which is why a backend proxy is the standard pattern.
    const domain = process.env.SHOPIFY_DOMAIN;
    const token = process.env.SHOPIFY_TOKEN;
    
    if (!domain || !token) {
        throw new Error("Shopify API credentials (SHOPIFY_DOMAIN, SHOPIFY_TOKEN) are not configured in the environment. These must be set on the server.");
    }
    
    const payload = { query, variables: variables || undefined };
    
    let response;
    try {
        response = await fetch(`https://${domain}/admin/api/2024-04/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token,
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new Error(
                'Network request failed. This is a Cross-Origin Resource Sharing (CORS) error. The Shopify Admin API is not designed for direct browser calls. You must proxy Admin API calls through a secure backend.'
            );
        }
        throw error; // Re-throw other errors
    }


    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shopify API error: ${response.statusText} - ${errorBody}`);
    }

    const json = await response.json();
    if (json.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
};

export const fetchProductList = async (): Promise<{ products: ShopifyProduct[] }> => {
    const query = `
    {
      products(first: 20) {
        edges {
          node {
            id
            title
            totalInventory
            variantForInventoryQuery: variants(first: 1) {
              edges {
                node {
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
    `;
    const data = await shopifyFetch(query);
    const products = data.products.edges.map((edge: any): ShopifyProduct => ({
        id: edge.node.id,
        name: edge.node.title,
        inventory: edge.node.totalInventory,
        inventoryItemId: edge.node.variantForInventoryQuery.edges[0]?.node.inventoryItem.id,
    }));
    return { products };
};

export const getUnfulfilledOrders = async (): Promise<{ orders: ShopifyOrder[] }> => {
    const query = `
    {
      orders(first: 20, query: "fulfillment_status:unfulfilled") {
        edges {
          node {
            id
            name
            customer {
              displayName
            }
            lineItems(first: 5) {
              edges {
                node {
                  quantity
                }
              }
            }
          }
        }
      }
    }
    `;
    const data = await shopifyFetch(query);
    const orders = data.orders.edges.map((edge: any): ShopifyOrder => ({
        id: edge.node.id,
        customer: edge.node.customer?.displayName || 'Unknown',
        items: edge.node.lineItems.edges.reduce((sum: number, itemEdge: any) => sum + itemEdge.node.quantity, 0),
        status: 'Unfulfilled',
    }));
    return { orders };
};

export const fetchCollections = async (): Promise<{ collections: ShopifyCollection[] }> => {
    const query = `
    {
      collections(first: 20) {
        edges {
          node {
            id
            title
            productsCount
          }
        }
      }
    }
    `;
    const data = await shopifyFetch(query);
    const collections = data.collections.edges.map((edge: any): ShopifyCollection => ({
        id: edge.node.id,
        title: edge.node.title,
        productsCount: edge.node.productsCount,
    }));
    return { collections };
};


export const fetchPages = async (): Promise<{ pages: ShopifyPage[] }> => {
    const query = `
    {
      pages(first: 20) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
    `;
    const data = await shopifyFetch(query);
    const pages = data.pages.edges.map((edge: any): ShopifyPage => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
    }));
    return { pages };
};

export const uploadProductImage = async (productId: string, imageUrl: string, altText: string): Promise<{ success: boolean; imageId?: string; error?: string }> => {
    const query = `
    mutation productCreateImages($productId: ID!, $images: [ImageInput!]!) {
      productCreateImages(productId: $productId, images: $images) {
        productImages {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
    `;
    const variables = {
        productId: productId,
        images: [{ src: imageUrl, altText: altText }]
    };
    try {
        const response = await shopifyFetch(query, variables);
        const userErrors = response.productCreateImages?.userErrors;
        if (userErrors && userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(', '));
        }
        const imageId = response.productCreateImages?.productImages?.[0]?.id;
        if (!imageId) {
            throw new Error("Image was created but no ID was returned.");
        }
        return { success: true, imageId };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error during image upload.";
        return { success: false, error: message };
    }
};

export const createCollection = async (title: string, descriptionHtml: string, productsToAdd: string[] | null = null): Promise<{ success: boolean; collectionId?: string; error?: string }> => {
    const query = `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
    `;
    const variables = {
        input: {
            title: title,
            descriptionHtml: descriptionHtml,
            products: productsToAdd,
        }
    };
    try {
        const response = await shopifyFetch(query, variables);
        const userErrors = response.collectionCreate?.userErrors;
        if (userErrors && userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(', '));
        }
        const collectionId = response.collectionCreate?.collection?.id;
        if (!collectionId) {
            throw new Error("Collection was created but no ID was returned.");
        }
        return { success: true, collectionId };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error during collection creation.";
        return { success: false, error: message };
    }
};


export const createPage = async (title: string, contentHtml: string, handle: string): Promise<{ success: boolean; pageId?: string; error?: string }> => {
    const query = `
    mutation pageCreate($input: PageInput!) {
      pageCreate(input: $input) {
        page {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
    `;
     const variables = {
        input: {
            title: title,
            bodyHtml: contentHtml,
            handle: handle,
        }
    };
    try {
        const response = await shopifyFetch(query, variables);
        const userErrors = response.pageCreate?.userErrors;
        if (userErrors && userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(', '));
        }
        const pageId = response.pageCreate?.page?.id;
        if (!pageId) {
            throw new Error("Page was created but no ID was returned.");
        }
        return { success: true, pageId };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error during page creation.";
        return { success: false, error: message };
    }
};

export const fulfillOrder = async (orderId: string, trackingNumber: string, carrier: string): Promise<{ success: boolean; fulfillmentId?: string; error?: string }> => {
    const fulfillmentOrderQuery = `
    query getFulfillmentOrder($orderId: ID!) {
      order(id: $orderId) {
        fulfillmentOrders(first: 10, query:"status:OPEN") {
          edges {
            node {
              id
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
    `;

    try {
        const fulfillmentOrderData = await shopifyFetch(fulfillmentOrderQuery, { orderId });
        const fulfillmentOrder = fulfillmentOrderData?.order?.fulfillmentOrders?.edges?.[0]?.node;

        if (!fulfillmentOrder) {
            throw new Error("No open fulfillment orders found for the given order ID.");
        }

        const fulfillmentOrderId = fulfillmentOrder.id;
        const lineItems = fulfillmentOrder.lineItems.edges.map((edge: any) => ({
            fulfillmentOrderLineItemId: edge.node.id,
            quantity: edge.node.quantity
        }));

        const fulfillmentMutation = `
        mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
          fulfillmentCreateV2(fulfillment: $fulfillment) {
            fulfillment {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
        `;

        const fulfillmentVariables = {
            fulfillment: {
                lineItemsByFulfillmentOrder: [{
                    fulfillmentOrderId: fulfillmentOrderId,
                    fulfillmentOrderLineItems: lineItems
                }],
                trackingInfo: {
                    number: trackingNumber,
                    company: carrier,
                },
                notifyCustomer: true
            }
        };
        
        const response = await shopifyFetch(fulfillmentMutation, fulfillmentVariables);
        const userErrors = response.fulfillmentCreateV2?.userErrors;
        if (userErrors && userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(', '));
        }
        const fulfillmentId = response.fulfillmentCreateV2?.fulfillment?.id;
        if (!fulfillmentId) {
            throw new Error("Fulfillment was created but no ID was returned.");
        }
        return { success: true, fulfillmentId };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error during fulfillment.";
        return { success: false, error: message };
    }
};

export const draftMarketingEmail = async (prompt: string): Promise<{ draft: string }> => {
    // This remains an LLM-based task, as Shopify has no "draft" API.
    // This function simulates the action for Luminous.
    return { draft: `Email draft for: "${prompt}"\n\nSubject: ✨ Special Offer for our Kinship! ✨\n\nHello,\n\nBased on your request, here is a special promotion for our most popular items...` };
};