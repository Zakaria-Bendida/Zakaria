import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le fichier .env depuis la racine du projet
dotenv.config({ path: path.join(__dirname, "../../.env") });

const { Pool } = pg;

// Get database name with fallback
const dbName = process.env.DB_NAME || "PostGis";
console.log("📝 Connecting to PostgreSQL database:", dbName);

const pgPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "PostGis",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgresql",
  ssl: { rejectUnauthorized: false }, // ← Force SSL pour Neon
  max: 20,
  idleTimeoutMillis: 30000,
});

// Test PostgreSQL connection
const testPGConnection = async () => {
  let client;
  try {
    client = await pgPool.connect();
    const result = await client.query("SELECT pgr_version()");
    console.log("✅ pgRouting version:", result.rows[0].pgr_version);
    client.release();
    return true;
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    if (client) client.release();
    return false;
  }
};

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_tracking",
    );
    console.log(
      "✅ MongoDB connected successfully to:",
      mongoose.connection.name,
    );
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    return false;
  }
};

const testAllConnections = async () => {
  const pgConnected = await testPGConnection();
  const mongoConnected = await connectMongoDB();

  if (pgConnected && mongoConnected) {
    console.log("✅ Both databases connected successfully!");
    return true;
  } else {
    console.error("❌ One or both database connections failed");
    return false;
  }
};

// ✅ Named exports
const pool = pgPool;
export {
  pgPool,
  pool,
  mongoose,
  connectMongoDB,
  testPGConnection,
  testAllConnections,
};
