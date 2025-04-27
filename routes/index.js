const express = require("express");
const router = express.Router();

function setupRoutes(logger) {
  // Home route
  router.get("/", (req, res) => {
    logger.info("Received request", { req });
    res.send("Hello from Express!");
  });

  // Error test route
  router.get("/err", (req, res) => {
    const error = new Error("Something went wrong on /err route");
    logger.error(error, { req });
    res.send("Hello from Express!");
  });

  return router;
}

module.exports = { setupRoutes };
