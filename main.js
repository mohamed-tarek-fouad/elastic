const http = require("http");
const { createApp } = require("./app");
const { logger, WebSocketTransport } = require("./config/logger");
const { setupWebSocketServer } = require("./services/websocket");

const PORT = process.env.PORT || 3000;

// Create Express app
const app = createApp();

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server
const wss = setupWebSocketServer(server, logger);

// Configure WebSocket transport with the WebSocket server
WebSocketTransport.setWebSocketServer(wss);

// Start server
logger.info("Server starting");
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
