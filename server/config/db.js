const mongoose = require("mongoose");

async function connectDB() {
  let uri = process.env.MONGO_URI || process.env.MONGO_URL;

  // If no real URI is provided (or it's pointing at a local mongo that isn't running),
  // fall back to an in-memory MongoDB instance so the project works out-of-the-box
  // without any external database installation.
  const isLocalPlaceholder =
    !uri ||
    uri.startsWith("mongodb://127.0.0.1") ||
    uri.startsWith("mongodb://localhost") ||
    uri.includes("<user>") ||
    uri.includes("<pass>");

  if (isLocalPlaceholder) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    console.log("⚡ No real MONGO_URI found — starting in-memory MongoDB for local dev...");
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    console.log(`✅ In-memory MongoDB started at: ${uri}`);
  }

  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
}

module.exports = connectDB;
