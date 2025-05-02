const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB Atlas via Mongoose");
  } catch (err) {
    console.error("❌ Mongoose connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
