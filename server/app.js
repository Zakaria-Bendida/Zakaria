import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
// import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import routes from "./routes/index.js";
import { testAllConnections } from "./config/database.js";
import initializeSocket from "./socket/index.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ==================== RATE LIMITING ====================
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 200,
//   message: {
//     success: false,
//     error: "Too many requests from this IP, please try again after 15 minutes",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: false,
// });

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   skipSuccessfulRequests: true,
//   message: {
//     success: false,
//     error: "Too many login attempts, please try again after 15 minutes",
//   },
// });

// // Apply global rate limit
// app.use(globalLimiter);

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// app.use(morgan("combined")); // ← Supprimé
app.use(cookieParser());

// ==================== Socket.IO Setup ====================
const io = initializeSocket(server);
app.set("io", io);

// ==================== ROUTES ====================
app.use("/api", routes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Ambulance Tracking System",
    socket: io ? "ready" : "not ready",
  });
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

app.use((err, req, res, next) => {
  // console.error("Global error:", err.stack); // ← Supprimé ou commenté
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// ==================== START SERVER ====================
const startServer = async () => {
  const dbConnected = await testAllConnections();

  if (!dbConnected) {
    console.error("❌ Cannot start server: Database connections failed");
    process.exit(1);
  }

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {});
};

startServer();

export { app, server, io };
