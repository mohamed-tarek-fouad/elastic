const express = require("express");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const ecsFormat = require("@elastic/ecs-winston-format");
const { createLogger, format, transports } = winston;
require("winston-daily-rotate-file");

const app = express();
const port = 3000;

// Use absolute path for Docker container
const logsDir = "/app/logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a rotating file transport
const rotateTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: "app-%DATE%.log",
  datePattern: "YYYY-MM-DD-HH",
  maxSize: "5m", // 5 megabytes
  maxFiles: 20, // Keep 20 files maximum
  auditFile: path.join(logsDir, "audit.json"),
  format: ecsFormat({ convertReqRes: true }),
  zippedArchive: false, // Don't zip old log files
  handleExceptions: true,
});

// Configure Winston logger with ECS format and rotating file
const logger = createLogger({
  level: "info",
  defaultMeta: { service: "express-app" },
  format: ecsFormat({ convertReqRes: true }),
  transports: [rotateTransport, new winston.transports.Console()],
});

// Add a route to generate more logs
app.get("/", (req, res) => {
  logger.info("Received request", { path: req.path });
  res.send("Hello from Express!");
});

logger.info("Server starting");
logger.error("Test error log", { err: new Error("boom") });

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(port, "Running");
});
