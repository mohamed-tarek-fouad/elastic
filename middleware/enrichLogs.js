const { format } = require("winston");
const geoip = require("geoip-lite");
const { normalizeIP } = require("../utils/ip");

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

module.exports = { enrichWithIPLocation };
