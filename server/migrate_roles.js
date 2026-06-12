require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("./models/User");

async function migrateRoles() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected. Running migration...");

    // Bypass schema validation for this update if we haven't updated the schema yet
    const result = await User.collection.updateMany(
      { role: "task_only" },
      { $set: { role: "task_only" } }
    );

    console.log(`Migration complete. Modified ${result.modifiedCount} users.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrateRoles();
