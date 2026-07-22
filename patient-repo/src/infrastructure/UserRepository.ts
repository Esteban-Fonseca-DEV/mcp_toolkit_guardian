export class UserRepository {
  async findById(id: string): Promise<{ id: string; name: string } | null> {
    // Simulated database lookup
    return { id, name: "John Doe" };
  }

  async save(user: { id: string; name: string }): Promise<void> {
    // Simulated database save
  }
}
