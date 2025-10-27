import { ShopifyProduct, ShopifyOrder } from '../types';

const getCredentials = () => {
    const domain = localStorage.getItem('LSS_SHOPIFY_DOMAIN');
    const token = localStorage.getItem('LSS_SHOPIFY_TOKEN');
    if (!domain || !token) {
        console.warn("Shopify admin credentials not found in local storage. Shopify tools will be disabled.");
        return null;
    }
    return { domain, token };
}

const getStorefrontCredentials = () => {
    const domain = localStorage.getItem('LSS_SHOPIFY_DOMAIN');
    const token = localStorage.getItem('LSS_SHOPIFY_STOREFRONT_TOKEN');
    if (!domain || !token) {
        console.warn("Shopify Storefront credentials not found in local storage. Public data tools will be disabled.");
        return null;
    }
    return { domain, token };
}

const shopifyFetch = async (query: string, variables: any = {}) => {
    const creds = getCredentials();
    if (!creds) throw new Error("Shopify Admin API credentials not configured.");

    const response = await fetch(`https://${creds.domain}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': creds.token,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
};

const shopifyStorefrontFetch = async (query: string, variables: any = {}) => {
    const creds = getStorefrontCredentials();
    if (!creds) throw new Error("Shopify Storefront API credentials not configured.");

    const response = await fetch(`https://${creds.domain}/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': creds.token,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Shopify Storefront API error: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
        throw new Error(`Shopify Storefront GraphQL error: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
};

export const fetchProductList = async (): Promise<{ products: ShopifyProduct[] }> => {
    const query = `
    {
      products(first: 10) {
        edges {
          node {
            id
            title
            variants(first: 20) {
              edges {
                node {
                  quantityAvailable
                }
              }
            }
          }
        }
      }
    }
    `;
    const data = await shopifyStorefrontFetch(query);
    const products = data.products.edges.map((edge: any): ShopifyProduct => {
        const totalInventory = edge.node.variants.edges.reduce((sum: number, variantEdge: any) => {
            return sum + (variantEdge.node.quantityAvailable || 0);
        }, 0);

        return {
            id: edge.node.id,
            name: edge.node.title,
            inventory: totalInventory,
        };
    });
    return { products };
};

export const getUnfulfilledOrders = async (): Promise<{ orders: ShopifyOrder[] }> => {
    const query = `
    {
      orders(first: 10, query: "fulfillment_status:unfulfilled") {
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

export const draftMarketingEmail = async (prompt: string): Promise<{ draft: string }> => {
    // This remains an LLM-based task, as Shopify has no "draft" API.
    // This function simulates the action for Luminous.
    return { draft: `Email draft for: "${prompt}"\n\nSubject: ✨ Special Offer for our Kinship! ✨\n\nHello,\n\nBased on your request, here is a special promotion for our most popular items...` };
};

// --- NEW SHOPIFY DIRECT ACTION TOOLS ---

export const uploadProductImage = async (productId: string, imageUrl: string, altText: string): Promise<{ success: boolean, output: string }> => {
    const query = `
        mutation productImageCreate($productId: ID!, $image: ImageInput!) {
            productImageCreate(productId: $productId, image: $image) {
                image {
                    id
                    src
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
        image: {
            src: imageUrl,
            altText: altText
        }
    };
    try {
        const data = await shopifyFetch(query, variables);
        if (data.productImageCreate.userErrors && data.productImageCreate.userErrors.length > 0) {
            return { success: false, output: `Failed to upload image: ${data.productImageCreate.userErrors.map((error: any) => error.message).join(', ')}` };
        }
        return { success: true, output: `Image uploaded for product ${productId}: ${data.productImageCreate.image.id}` };
    } catch (e: any) {
        return { success: false, output: `An error occurred: ${e.message}` };
    }
};

export const createCollection = async (title: string, descriptionHtml: string, productsToAdd: string[] | null = null): Promise<{ success: boolean, output: string, collectionId?: string }> => {
    const createCollectionQuery = `
        mutation collectionCreate($input: CollectionInput!) {
            collectionCreate(input: $input) {
                collection {
                    id
                    title
                    handle
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;
    const createCollectionVariables = {
        input: {
            title: title,
            descriptionHtml: descriptionHtml,
            handle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, ''),
            publishedScope: "GLOBAL",
        }
    };

    try {
        // Step 1: Create the collection
        const createData = await shopifyFetch(createCollectionQuery, createCollectionVariables);
        if (createData.collectionCreate.userErrors && createData.collectionCreate.userErrors.length > 0) {
            return { success: false, output: `Failed to create collection: ${createData.collectionCreate.userErrors.map((error: any) => error.message).join(', ')}` };
        }
        const collectionId = createData.collectionCreate.collection.id;
        let outputMessage = `Collection '${title}' created with ID: ${collectionId}.`;

        // Step 2: Add products if specified
        if (productsToAdd && productsToAdd.length > 0) {
            const addProductsQuery = `
                mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
                    collectionAddProducts(id: $id, productIds: $productIds) {
                        collection {
                            id
                            products(first: 5) { # Fetch a few to confirm
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
                }
            `;
            const addProductsVariables = {
                id: collectionId,
                productIds: productsToAdd,
            };
            const addData = await shopifyFetch(addProductsQuery, addProductsVariables);
            if (addData.collectionAddProducts.userErrors && addData.collectionAddProducts.userErrors.length > 0) {
                outputMessage += ` Failed to add products: ${addData.collectionAddProducts.userErrors.map((error: any) => error.message).join(', ')}.`;
                return { success: false, output: outputMessage, collectionId: collectionId }; // Partial success, but failed to add products
            } else {
                 outputMessage += ` Successfully added ${productsToAdd.length} products to collection.`;
            }
        }
        return { success: true, output: outputMessage, collectionId: collectionId };
    } catch (e: any) {
        return { success: false, output: `An error occurred: ${e.message}` };
    }
};

export const fulfillOrder = async (orderId: string, trackingNumber: string, carrier: string): Promise<{ success: boolean, output: string }> => {
    const query = `
        mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
            fulfillmentCreateV2(fulfillment: $fulfillment) {
                fulfillment {
                    id
                    status
                    trackingInfo {
                        number
                        company
                        url
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;
    const variables = {
        fulfillment: {
            orderId: orderId,
            lineItemsByFulfillmentOrder: [], 
            trackingInfo: {
                number: trackingNumber,
                company: carrier
            },
            notifyCustomer: true,
        }
    };
    try {
        const data = await shopifyFetch(query, variables);
        if (data.fulfillmentCreateV2.userErrors && data.fulfillmentCreateV2.userErrors.length > 0) {
            return { success: false, output: `Failed to fulfill order: ${data.fulfillmentCreateV2.userErrors.map((error: any) => error.message).join(', ')}` };
        }
        return { success: true, output: `Order ${orderId} fulfilled. Fulfillment ID: ${data.fulfillmentCreateV2.fulfillment.id}, Status: ${data.fulfillmentCreateV2.fulfillment.status}` };
    } catch (e: any) {
        return { success: false, output: `An error occurred: ${e.message}` };
    }
};

export const createPage = async (title: string, contentHtml: string, handle: string): Promise<{ success: boolean, output: string, pageId?: string }> => {
    const query = `
        mutation pageCreate($input: PageInput!) {
            pageCreate(input: $input) {
                page {
                    id
                    title
                    handle
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
            published: true
        }
    };
    try {
        const data = await shopifyFetch(query, variables);
        if (data.pageCreate.userErrors && data.pageCreate.userErrors.length > 0) {
            return { success: false, output: `Failed to create page: ${data.pageCreate.userErrors.map((error: any) => error.message).join(', ')}` };
        }
        return { success: true, output: `Page '${title}' created with ID: ${data.pageCreate.page.id}.`, pageId: data.pageCreate.page.id };
    } catch (e: any) {
        return { success: false, output: `An error occurred: ${e.message}` };
    }
};