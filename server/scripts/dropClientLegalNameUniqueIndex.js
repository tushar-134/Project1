require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required.");

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection("clients");
  const indexes = await collection.indexes();
  const uniqueLegalNameIndexes = indexes.filter((index) => (
    index.unique === true
    && index.key
    && Object.keys(index.key).length === 1
    && index.key.legalName === 1
  ));

  if (!uniqueLegalNameIndexes.length) {
    console.log("No unique legalName index found on clients.");
    return;
  }

  for (const index of uniqueLegalNameIndexes) {
    console.log(`Dropping unique index ${index.name} from clients...`);
    await collection.dropIndex(index.name);
  }

  console.log("Unique legalName index cleanup complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
