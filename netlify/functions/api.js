require('dotenv').config();
const serverless = require('serverless-http');
const { initDatabase } = require('../../backend/database/db');
const app = require('../../backend/server');

let ready = false;

module.exports.handler = async (event, context) => {
  if (!ready) {
    await initDatabase();
    ready = true;
  }
  return serverless(app)(event, context);
};
