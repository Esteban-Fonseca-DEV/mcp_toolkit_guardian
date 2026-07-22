// VIOLATION: DDD_DIRECT_INTERNAL_ACCESS — imports internal entity directly
import { OrderItem } from "../domain/order/OrderItem";

export class OrderService {
  createItem(productId: string, qty: number): OrderItem {
    return new OrderItem(productId, qty);
  }
}
