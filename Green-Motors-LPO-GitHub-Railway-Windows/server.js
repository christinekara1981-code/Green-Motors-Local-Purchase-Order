"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "outputs");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gs": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".zip": "application/zip"
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = requestPath === "/" ? "Green-Motors-LPO.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relativePath);

  if (!filePath.startsWith(path.resolve(publicDir) + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Green Motors LPO running on port ${port}`);
});
