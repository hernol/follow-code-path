import { insertOrder } from "./orders-db.ts";

type OrderInput = {
  cartId: string;
};

type Order = {
  id: string;
  cartId: string;
};

export async function createOrder(body: unknown): Promise<Order> {
  const parsed = parseBody(body);
  if (!parsed.ok) {
    return validationError(parsed.error);
  }

  const order = await insertOrder({
    id: `ord_${Date.now()}`,
    cartId: parsed.value.cartId,
  });

  return order;
}

function parseBody(body: unknown):
  | { ok: true; value: OrderInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || !("cartId" in body)) {
    return { ok: false, error: "cartId required" };
  }
  const cartId = (body as { cartId: unknown }).cartId;
  if (typeof cartId !== "string" || cartId.length === 0) {
    return { ok: false, error: "cartId required" };
  }
  return { ok: true, value: { cartId } };
}

function validationError(error: string): never {
  const err = new Error(error);
  (err as Error & { status: number }).status = 400;
  throw err;
}
