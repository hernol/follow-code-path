import { createOrder } from "./create-order.ts";

type Request = {
  headers: Record<string, string | undefined>;
  body: unknown;
};

type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => unknown;
};

export async function postOrders(req: Request, res: Response) {
  const session = req.headers["x-session"];
  if (!session) {
    return unauthorized(res);
  }

  const order = await createOrder(req.body);
  return res.status(201).json(order);
}

function unauthorized(res: Response) {
  return res.status(401).json({ error: "unauthorized" });
}
