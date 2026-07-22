export class OrderRepository {
  async findByUserId(userId: string): Promise<{ id: string; total: number }[]> {
    // Simulated database lookup
    return [{ id: "order-1", total: 99.99 }];
  }

  async save(order: { id: string; total: number }): Promise<void> {
    // Simulated database save
  }
}
