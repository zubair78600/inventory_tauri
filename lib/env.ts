// Environment variables for Tauri - simplified for static export
// Database and backend logic will be handled by Rust in later phases

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Auth and other server-side env vars will be configured in Phase 10
  AUTH_SECRET: process.env.AUTH_SECRET || 'dev-secret-change-in-production',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};
