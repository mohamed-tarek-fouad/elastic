const express = require("express");
const { logger } = require("./config/logger");
const { setupRoutes } = require("./routes/index");

function createApp() {
  const app = express();

  // Set trust proxy for accurate IP extraction
  app.set("trust proxy", true);

  // Routes configuration
  app.use("/", setupRoutes(logger));

  return app;
}

module.exports = { createApp };
