const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGO_URI from .env. Exits the process on
 * failure - there's no useful degraded mode without a database, so it's
 * better to fail loudly at startup than error on every request later.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;