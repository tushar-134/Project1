const mongoose = require("mongoose");

async function connectDB() {
  // Connection is centralized so boot, seed, and future scripts all share the same Mongo setup.
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
}

module.exports = connectDB;
