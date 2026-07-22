// VIOLATION: Domain layer importing from Infrastructure layer
import { UserRepository } from "../infrastructure/UserRepository";

export class UserService {
  private repo = new UserRepository();

  async getUser(id: string) {
    return this.repo.findById(id);
  }
}
