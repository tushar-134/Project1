const mongoose = require("mongoose");

async function connectDB() {
  // Connection is centralized so boot, seed, and future scripts all share the same Mongo setup.
  const uri = process.env.MONGO_URI || process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URI or MONGO_URL is required");
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
}

module.exports = connectDB;
