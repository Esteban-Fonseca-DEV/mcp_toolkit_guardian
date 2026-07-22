// VIOLATION: Domain layer importing from Infrastructure layer
import { ProductRepository } from "../infrastructure/ProductRepository";

export class ProductService {
  private repo = new ProductRepository();

  async listProducts() {
    return this.repo.findAll();
  }
}
