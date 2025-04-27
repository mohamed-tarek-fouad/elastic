const express = require("express");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const ecsFormat = require("@elastic/ecs-winston-format");
const { createLogger, format, transports } = winston;
const http = require("http");
const WebSocket = require("ws");
const geoip = require("geoip-lite");
require("winston-daily-rotate-file");

const app = express();
const port = 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const logsDir = "/app/logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Set trust proxy for accurate IP extraction
app.set("trust proxy", true);
function normalizeIP(ip) {
  // Strip IPv6 prefix if it's an IPv4-mapped address
  if (ip?.startsWith("::ffff:")) {
    return ip.replace("::ffff:", "");
  }
  return ip;
}
// Custom Winston format to enrich logs with IP + geolocation
const enrichWithIPLocation = format((info) => {
  const req = info.req;

  if (req) {
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress;

    ip = normalizeIP(ip);
    info.ip = ip;

    const location = geoip.lookup(ip);

    if (location) {
      info.geo = location;
    } else {
      // Generate random coordinates within Kuwait if no location found
      const randomLat = 28.5 + Math.random() * (30.1 - 28.5);
      const randomLng = 46.5 + Math.random() * (48.5 - 46.5);
      info.geo = {
        latitude: randomLat,
        longitude: randomLng,
      };

      console.log("🔶 Generated random Kuwait location:", info.geo);
    }
  }

  return info;
});
// WebSocket transport for logs
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
  maxSize: "5m",
  maxFiles: 20,
  auditFile: path.join(logsDir, "audit.json"),
  format: ecsFormat({ convertReqRes: true }),
  zippedArchive: false,
  handleExceptions: true,
});

const logger = createLogger({
  level: "info",
  defaultMeta: { service: "express-app" },
  format: format.combine(
    enrichWithIPLocation(), // Add geo enrichment
    ecsFormat({ convertReqRes: true })
  ),
  transports: [
    rotateTransport,
    new winston.transports.Console(),
    new WebSocketTransport(),
  ],
});

// WebSocket server setup
wss.on("connection", (ws) => {
  logger.info("Client connected to WebSocket");

  ws.subscribedTopics = [];

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.action === "subscribe" && data.topic) {
        if (!ws.subscribedTopics.includes(data.topic)) {
          ws.subscribedTopics.push(data.topic);
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

// Routes
app.get("/", (req, res) => {
  logger.info("Received request", { req });
  res.send("Hello from Express!");
});

app.get("/err", (req, res) => {
  const error = new Error("Something went wrong on /err route");
  logger.error(error, { req });
  res.send("Hello from Express!");
});

// Start server
logger.info("Server starting");
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`Server running on port ${port}`);
});
