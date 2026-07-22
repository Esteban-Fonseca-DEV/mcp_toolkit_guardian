export class ProductRepository {
  async findAll(): Promise<{ id: string; name: string; price: number }[]> {
    // Simulated database lookup
    return [{ id: "prod-1", name: "Widget", price: 29.99 }];
  }

  async findById(id: string): Promise<{ id: string; name: string; price: number } | null> {
    return { id, name: "Widget", price: 29.99 };
  }
}
