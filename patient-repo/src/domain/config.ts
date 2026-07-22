// VIOLATION: SECRET_EXPOSED_AWS_ACCESS_KEY — hardcoded AWS key in source code
// This should never be committed to version control
const API_KEY = "AKIAIOSFODNN7EXAMPLE";
const DB_CONNECTION = "postgres://admin:secretpassword123@prod-db.example.com:5432/mydb";

export function getApiKey(): string {
  return API_KEY;
}

export function getDbConnection(): string {
  return DB_CONNECTION;
}
