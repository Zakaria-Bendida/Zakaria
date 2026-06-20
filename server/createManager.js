// server/createManager.js — script temporaire, à supprimer après usage
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const createManager = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connecté à MongoDB");

    const email = "admin@manager.com"; // ← change si tu veux
    const plainPassword = "Admin123!"; // ← change si tu veux
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("⚠️ Ce compte existe déjà:", email);
      process.exit(0);
    }

    const manager = await User.create({
      email,
      passwordHash,
      fullName: "Admin Manager",
      role: "manager",
      isActive: true,
    });

    console.log("✅ Compte manager créé avec succès !");
    console.log("Email:", email);
    console.log("Mot de passe:", plainPassword);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }
};

createManager();
