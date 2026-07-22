// VIOLATION: Domain layer importing from Infrastructure layer
import { OrderRepository } from "../infrastructure/OrderRepository";

export class OrderService {
  private repo = new OrderRepository();

  async getOrdersForUser(userId: string) {
    return this.repo.findByUserId(userId);
  }
}
