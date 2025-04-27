const winston = require("winston");
const path = require("path");
const fs = require("fs");
const ecsFormat = require("@elastic/ecs-winston-format");
const { createLogger, format, transports } = winston;
const { enrichWithIPLocation } = require("../middleware/enrichLogs");
require("winston-daily-rotate-file");

const logsDir = "/app/logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class WebSocketTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.name = "websocket";
    this.wss = null;
  }

  setWebSocketServer(wss) {
    this.wss = wss;
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (
          client.readyState === 1 && // WebSocket.OPEN
          client.subscribedTopics?.includes("logs")
        ) {
          client.send(JSON.stringify(info));
        }
      });
    }

    callback();
  }
}

const rotateTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: "app-%DATE%",
  datePattern: "YYYY-MM-DD-HH",
  extension: ".log",
  maxSize: "5m",
  maxFiles: 20,
  auditFile: path.join(logsDir, "audit.json"),
  format: ecsFormat({ convertReqRes: true }),
  zippedArchive: false,
  handleExceptions: true,
});

// Create WebSocket transport instance for later configuration
const wsTransport = new WebSocketTransport();

// Create logger
const logger = createLogger({
  level: "info",
  defaultMeta: { service: "express-app" },
  format: format.combine(
    enrichWithIPLocation(),
    ecsFormat({ convertReqRes: true })
  ),
  transports: [rotateTransport, new winston.transports.Console(), wsTransport],
});

module.exports = {
  logger,
  WebSocketTransport: wsTransport,
};
