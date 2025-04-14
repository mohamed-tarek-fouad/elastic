const express = require("express");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const ecsFormat = require("@elastic/ecs-winston-format");
const { createLogger, format, transports } = winston;
const http = require("http");
const WebSocket = require("ws");
require("winston-daily-rotate-file");

const app = express();
const port = 3000;

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

const logsDir = "/app/logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create custom transport for WebSocket
class WebSocketTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.name = "websocket";
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    wss.clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.subscribedTopics?.includes("logs")
      ) {
        client.send(JSON.stringify(info));
      }
    });

    callback();
  }
}

const rotateTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: "app-%DATE%",
  datePattern: "YYYY-MM-DD-HH",
  extension: ".log",
  maxSize: "5k",
  maxFiles: 20,
  auditFile: path.join(logsDir, "audit.json"),
  format: ecsFormat({ convertReqRes: true }),
  zippedArchive: false,
  handleExceptions: true,
});

const logger = createLogger({
  level: "info",
  defaultMeta: { service: "express-app" },
  format: ecsFormat({ convertReqRes: true }),
  transports: [
    rotateTransport,
    new winston.transports.Console(),
    new WebSocketTransport(),
  ],
});

wss.on("connection", (ws) => {
  logger.info("Client connected to WebSocket");

  ws.subscribedTopics = [];

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.action === "subscribe" && data.topic) {
        if (!ws.subscribedTopics.includes(data.topic)) {
          ws.subscribedTopics.push(data.topic);
          logger.info(`Client subscribed to topic: ${data.topic}`);
          ws.send(
            JSON.stringify({
              status: "success",
              message: `Subscribed to ${data.topic}`,
            })
          );
        }
      }

      if (data.action === "unsubscribe" && data.topic) {
        ws.subscribedTopics = ws.subscribedTopics.filter(
          (topic) => topic !== data.topic
        );
        logger.info(`Client unsubscribed from topic: ${data.topic}`);
        ws.send(
          JSON.stringify({
            status: "success",
            message: `Unsubscribed from ${data.topic}`,
          })
        );
      }
    } catch (err) {
      logger.error("Error processing WebSocket message", { err });
      ws.send(
        JSON.stringify({ status: "error", message: "Invalid message format" })
      );
    }
  });

  ws.on("close", () => {
    logger.info("Client disconnected from WebSocket");
  });
});

app.get("/", (req, res) => {
  logger.info("Received request", { path: req.path });
  res.send("Hello from Express!");
});

logger.info("Server starting");
logger.error("Test error log", { err: new Error("boom") });

server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`Server running on port ${port}`);
});
