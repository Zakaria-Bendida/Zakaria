// src/config/jwt.js (ESM version)
const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("❌ JWT_SECRET is not defined in .env file!");
    console.error("   Please add JWT_SECRET to your .env file");
    console.error("   Using temporary secret for now...");
    return "development_secret_key_do_not_use_in_production";
  }
  // Show first few characters for debugging (don't show full secret in production!)
  console.log(
    `✅ JWT_SECRET loaded: ${secret.substring(0, 10)}... (length: ${secret.length})`,
  );
  return secret;
};

const getJWTExpiry = () => {
  return process.env.JWT_EXPIRES_IN || "24h";
};

// ✅ ES module exports
export { getJWTSecret, getJWTExpiry };
