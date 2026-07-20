// Fixture UI handler for sample Path Document walkthroughs.
type Cart = { id: string; items: string[] };

export function CheckoutButton({ cart }: { cart: Cart }) {
  async function onPlaceOrder() {
    if (!cart.id) {
      throw new Error("missing cart id");
    }

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartId: cart.id }),
    });

    if (!response.ok) {
      throw new Error(`order failed: ${response.status}`);
    }

    return response.json();
  }

  return { onPlaceOrder };
}
