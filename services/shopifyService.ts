
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

const shopifyFetch = async (query: string) => {
    const creds = getCredentials();
    if (!creds) throw new Error("Shopify API credentials not configured.");
    
    const response = await fetch(`https://${creds.domain}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': creds.token,
        },
        body: JSON.stringify({ query }),
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