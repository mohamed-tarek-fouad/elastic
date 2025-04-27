function normalizeIP(ip) {
  if (ip?.startsWith("::ffff:")) {
    return ip.replace("::ffff:", "");
  }
  return ip;
}

module.exports = { normalizeIP };
