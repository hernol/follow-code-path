type Order = {
  id: string;
  cartId: string;
};

const orders: Order[] = [];

export async function insertOrder(order: Order): Promise<Order> {
  orders.push(order);
  return order;
}

export function listOrders(): Order[] {
  return [...orders];
}
