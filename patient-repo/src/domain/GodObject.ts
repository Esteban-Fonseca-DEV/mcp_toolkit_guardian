// VIOLATION: SRP_GOD_OBJECT — Class with too many responsibilities
// This class handles user management, authentication, validation, notification,
// logging, and data transformation all in one place

export class UserManager {
  private users: Map<string, any> = new Map();
  private sessions: Map<string, any> = new Map();
  private logs: string[] = [];

  constructor(
    private readonly db: any,
    private readonly cache: any,
    private readonly mailer: any,
    private readonly logger: any,
    private readonly validator: any,
    private readonly hasher: any
  ) {}

  // Authentication methods
  async login(email: string, password: string): Promise<any> {
    this.log(`Login attempt: ${email}`);
    const user = await this.findByEmail(email);
    if (!user) throw new Error("User not found");
    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error("Invalid password");
    return this.createSession(user);
  }

  async logout(sessionId: string): Promise<void> {
    this.log(`Logout: ${sessionId}`);
    this.sessions.delete(sessionId);
  }

  async register(data: any): Promise<any> {
    this.log(`Register: ${data.email}`);
    this.validateEmail(data.email);
    this.validatePassword(data.password);
    const hash = await this.hashPassword(data.password);
    const user = { ...data, passwordHash: hash, id: this.generateId() };
    this.users.set(user.id, user);
    await this.sendWelcomeEmail(user);
    return user;
  }

  // User CRUD
  async findById(id: string): Promise<any> {
    return this.users.get(id) ?? await this.db.find(id);
  }

  async findByEmail(email: string): Promise<any> {
    for (const [, user] of this.users) {
      if (user.email === email) return user;
    }
    return await this.db.findByEmail(email);
  }

  async updateProfile(id: string, data: any): Promise<any> {
    const user = await this.findById(id);
    if (!user) throw new Error("User not found");
    Object.assign(user, data);
    this.users.set(id, user);
    this.log(`Profile updated: ${id}`);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
    this.log(`User deleted: ${id}`);
  }

  // Validation
  validateEmail(email: string): void {
    if (!email.includes("@")) throw new Error("Invalid email");
    if (email.length > 255) throw new Error("Email too long");
  }

  validatePassword(password: string): void {
    if (password.length < 8) throw new Error("Password too short");
    if (!/[A-Z]/.test(password)) throw new Error("Password needs uppercase");
    if (!/[0-9]/.test(password)) throw new Error("Password needs number");
  }

  // Security
  async hashPassword(password: string): Promise<string> {
    return this.hasher.hash(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.hasher.verify(password, hash);
  }

  // Session management
  createSession(user: any): any {
    const sessionId = this.generateId();
    const session = { id: sessionId, userId: user.id, createdAt: new Date() };
    this.sessions.set(sessionId, session);
    return session;
  }

  // Notifications
  async sendWelcomeEmail(user: any): Promise<void> {
    await this.mailer.send({
      to: user.email,
      subject: "Welcome!",
      body: `Hello ${user.name}, welcome to our platform.`
    });
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) return;
    const token = this.generateId();
    await this.mailer.send({
      to: email,
      subject: "Password Reset",
      body: `Use this token: ${token}`
    });
  }

  // Utilities
  private generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    this.logger.info(message);
  }

  // Data transformation
  toPublicProfile(user: any): any {
    return { id: user.id, name: user.name, email: user.email };
  }

  toAdminView(user: any): any {
    return { ...user, logs: this.logs.filter(l => l.includes(user.id)) };
  }

  // Reporting
  async getUserStats(): Promise<any> {
    return {
      total: this.users.size,
      activeSessions: this.sessions.size,
      logEntries: this.logs.length,
    };
  }

  // Cache management
  async warmCache(): Promise<void> {
    for (const [id, user] of this.users) {
      await this.cache.set(`user:${id}`, user);
    }
  }

  async invalidateCache(id: string): Promise<void> {
    await this.cache.delete(`user:${id}`);
  }
}
