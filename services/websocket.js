const WebSocket = require("ws");

function setupWebSocketServer(server, logger) {
  const wss = new WebSocket.Server({ server });

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
          JSON.stringify({
            status: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    ws.on("close", () => {
      logger.info("Client disconnected from WebSocket");
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };
