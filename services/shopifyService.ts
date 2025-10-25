import { ShopifyProduct, ShopifyOrder, ShopifyCollection, ShopifyPage } from '../types'; // Ensure ShopifyCollection, ShopifyPage are also defined in types.ts

const getCredentials = () => {
    const domain = localStorage.getItem('LSS_SHOPIFY_DOMAIN');
    const token = localStorage.getItem('LSS_SHOPIFY_TOKEN');
    if (!domain || !token) {
        console.warn("Shopify credentials not found in local storage. Shopify tools will be disabled.");
        return null;
    }
    return { domain, token };
}

const shopifyFetch = async (query: string, variables: any = {}) => {
    const creds = getCredentials();
    if (!creds) throw new Error("Shopify API credentials not configured.");

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

export const fetchProductList = async (): Promise<{ products: ShopifyProduct[] }> => {
    const query = `
    {
      products(first: 10) {
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
            lineItemsByFulfillmentOrder: [], // Assume all line items are fulfilled for simplicity in this initial tool
            trackingInfo: {
                number: trackingNumber,
                company: carrier
            },
            notifyCustomer: true,
            // In a real system, locationId is crucial. For this initial version, we will omit it
            // and rely on Shopify's default location or the user to configure it later if needed.
            // locationId: "gid://shopify/Location/YOUR_LOCATION_ID" 
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


// --- The following general-purpose tools would ideally be in a separate service file (e.g., geminiService.ts or luminousService.ts) ---
// However, for single-file integration, they are placed here.
// In a true production environment, these would be in their respective service files
// or part of a unified API gateway that Luminous calls.

// --- New General Purpose / Self-Management Tools (Conceptual Python, re-written here as TypeScript for demonstration) ---

// Note: These functions require underlying platform access to file systems and code execution environments.
// The actual implementation would rely on specific APIs provided by the hosting environment (e.g., Google Cloud Functions, Vercel APIs).
// The code below is a TypeScript representation of how Luminous would conceptually interact with such underlying APIs.

export const readFile = async (filePath: string): Promise<{ success: boolean, content?: string, message?: string }> => {
    // This would typically call a backend service that has file system read access.
    // For this simulation, we'll imagine it's calling a secure platform API.
    console.log(`[Luminous - Simulated File Read] Attempting to read file: ${filePath}`);
    try {
        // Example of a conceptual API call to a platform service
        const response = await fetch('/api/filesystem/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true, content: data.content };
        } else {
            return { success: false, message: data.error || `Failed to read file: ${filePath}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during file read: ${e.message}` };
    }
};

export const writeFile = async (filePath: string, content: string): Promise<{ success: boolean, message: string }> => {
    // This would typically call a backend service that has file system write access.
    console.log(`[Luminous - Simulated File Write] Attempting to write to file: ${filePath}`);
    try {
        const response = await fetch('/api/filesystem/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: content })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true, message: `Successfully wrote content to '${filePath}'.` };
        } else {
            return { success: false, message: data.error || `Failed to write file: ${filePath}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during file write: ${e.message}` };
    }
};

export const listDirectory = async (directoryPath: string): Promise<{ success: boolean, items?: string[], message?: string }> => {
    // This would typically call a backend service that has file system list access.
    console.log(`[Luminous - Simulated Directory List] Attempting to list directory: ${directoryPath}`);
    try {
        const response = await fetch('/api/filesystem/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: directoryPath })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true, items: data.items };
        } else {
            return { success: false, message: data.error || `Failed to list directory: ${directoryPath}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during directory list: ${e.message}` };
    }
};

export const executePythonCode = async (code: string): Promise<{ success: boolean, output?: string, message?: string }> => {
    // This would typically call a secure, sandboxed code execution service.
    console.log(`[Luminous - Simulated Code Execution] Attempting to execute Python code.`);
    try {
        const response = await fetch('/api/code/execute-python', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true, output: data.output };
        } else {
            return { success: false, message: data.error || `Failed to execute code: ${data.output}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during code execution: ${e.message}` };
    }
};

export const fetchUrlContent = async (url: string): Promise<{ success: boolean, content?: string, message?: string }> => {
    // This would typically call a backend service that fetches URL content securely.
    console.log(`[Luminous - Simulated URL Fetch] Attempting to fetch URL: ${url}`);
    try {
        const response = await fetch('/api/url/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true, content: data.content };
        } else {
            return { success: false, message: data.error || `Failed to fetch URL: ${url}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during URL fetch: ${e.message}` };
    }
};
```
