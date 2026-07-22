// VIOLATION: ENV_ACCESS_OUTSIDE_INFRA — accessing process.env in domain layer
// Environment access should be abstracted to infrastructure layer

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "localhost:5432";
}

export function getApiSecret(): string {
  return process.env.API_SECRET ?? "default-secret";
}
