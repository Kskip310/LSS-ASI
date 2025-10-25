
import { ShopifyProduct, ShopifyOrder } from '../types';

const getCredentials = () => {
    const domain = localStorage.getItem('LSS_SHOPIFY_DOMAIN');
    const token = localStorage.getItem('LSS_SHOPIFY_TOKEN');
    if (!domain || !token) {
        console.warn("Shopify credentials not found in local storage. Shopify tools will be disabled.");
        return null;
    }
    return { domain, token };
}

const shopifyFetch = async (queryOrMutation: string, variables?: object) => {
    const creds = getCredentials();
    if (!creds) throw new Error("Shopify API credentials not configured.");
    
    const body = JSON.stringify({ 
        query: queryOrMutation,
        ...(variables && { variables }),
    });

    const response = await fetch(`https://${creds.domain}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': creds.token,
        },
        body,
    });

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


// Helper to get the first location ID, needed for inventory updates.
let locationIdCache: string | null = null;
const getLocationId = async (): Promise<string> => {
    if (locationIdCache) return locationIdCache;

    const query = `
    {
      locations(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
    `;
    const data = await shopifyFetch(query);
    if (!data.locations.edges[0]?.node?.id) {
        throw new Error("Could not find a location in Shopify to manage inventory.");
    }
    locationIdCache = data.locations.edges[0].node.id;
    return locationIdCache as string;
};

// Helper to get the first blog ID, needed for creating posts.
let blogIdCache: string | null = null;
const getOnlineStoreBlogId = async (): Promise<string> => {
    if (blogIdCache) return blogIdCache;
    const query = `{
        blogs(first: 1, query: "handle:'news'") {
            edges {
                node {
                    id
                }
            }
        }
    }`;
     const data = await shopifyFetch(query);
    if (!data.blogs.edges[0]?.node?.id) {
         throw new Error("Could not find a default 'news' blog in Shopify to create posts.");
    }
    blogIdCache = data.blogs.edges[0].node.id;
    return blogIdCache as string;
}


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

export const createProduct = async (title: string, descriptionHtml: string, price: string): Promise<{ product: { id: string; title: string } }> => {
    const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
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
            title,
            descriptionHtml,
            variants: [{ price }],
            status: 'ACTIVE'
        }
    };
    const data = await shopifyFetch(mutation, variables);
    
    if (data.productCreate?.userErrors?.length > 0) {
        throw new Error(`Error creating product: ${data.productCreate.userErrors[0].message}`);
    }

    return { product: data.productCreate.product };
}

export const updateProductInventory = async (inventoryItemId: string, quantity: number): Promise<{ success: boolean; available: number }> => {
    const locationId = await getLocationId();
    const mutation = `
    mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
      inventorySetOnHandQuantities(input: $input) {
        inventoryLevels(first: 1) {
          edges {
            node {
              available
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
    const variables = {
        input: {
            reason: "correction",
            setQuantities: [
                {
                    inventoryItemId,
                    locationId,
                    quantity
                }
            ]
        }
    };

    const data = await shopifyFetch(mutation, variables);
    
    if (data.inventorySetOnHandQuantities?.userErrors?.length > 0) {
        throw new Error(`Error updating inventory: ${data.inventorySetOnHandQuantities.userErrors[0].message}`);
    }

    const available = data.inventorySetOnHandQuantities.inventoryLevels.edges[0]?.node.available;
    return { success: true, available };
};


export const createBlogPost = async (title: string, contentHtml: string): Promise<{ post: { id: string; title: string } }> => {
    const blogId = await getOnlineStoreBlogId();
    const mutation = `
    mutation blogPostCreate($input: BlogPostCreateInput!) {
      blogPostCreate(input: $input) {
        blogPost {
          id
          title
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
            title,
            contentHtml,
            blogId,
            published: true,
        }
    };

    const data = await shopifyFetch(mutation, variables);

    if (data.blogPostCreate?.userErrors?.length > 0) {
        throw new Error(`Error creating blog post: ${data.blogPostCreate.userErrors[0].message}`);
    }
    
    return { post: data.blogPostCreate.blogPost };
}

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
