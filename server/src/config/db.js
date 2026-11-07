const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDb() {
  mongoose.set('strictQuery', true);
  mongoose.set('maxTimeMS', 8000);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 20000,
  });
  logger.info('MongoDB connected');
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
