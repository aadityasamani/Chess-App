const mongoose = require('mongoose');

const uri = "mongodb+srv://aaditya:wGG9ZnfKR9HsHTzL@chessup-cluster.ntvtfjk.mongodb.net/?retryWrites=true&w=majority&appName=chessup-cluster";

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
