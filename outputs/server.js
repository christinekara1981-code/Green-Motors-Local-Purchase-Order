"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "outputs");
const googleAppsScriptUrl = (
  process.env.GOOGLE_APPS_SCRIPT_URL ||
  process.env.GOOGLE_SCRIPT_URL ||
  ""
).trim().replace(/^["']|["']$/g, "");
const buildVersion = "2026.06.12.4";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gs": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".zip": "application/zip"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error("Request is too large."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function proxyGoogleRequest(request, response, requestPath) {
  if (!googleAppsScriptUrl) {
    sendJson(response, 503, {
      ok: false,
      error: "GOOGLE_APPS_SCRIPT_URL is missing from this Railway service's production environment."
    });
    return;
  }

  try {
    const queryAction = request.method === "GET" && requestPath === "/api/lpo/next"
      ? "next-number"
      : request.method === "GET" && requestPath === "/api/lpo"
        ? "list-records"
        : "";
    const targetUrl = queryAction
      ? `${googleAppsScriptUrl}${googleAppsScriptUrl.includes("?") ? "&" : "?"}action=${queryAction}`
      : googleAppsScriptUrl;
    const options = queryAction
      ? { method: "GET", redirect: "follow" }
      : {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: await readBody(request)
        };
    const googleResponse = await fetch(targetUrl, options);
    const text = await googleResponse.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Google Apps Script returned an invalid response.");
    }
    sendJson(response, payload.ok === false ? 502 : 200, payload);
  } catch (error) {
    sendJson(response, 502, { ok: false, error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);

  if (request.method === "GET" && requestPath === "/api/config") {
    sendJson(response, 200, {
      googleSheetsConnected: Boolean(googleAppsScriptUrl),
      buildVersion,
      expectedVariable: "GOOGLE_APPS_SCRIPT_URL"
    });
    return;
  }
  if (
    (request.method === "POST" && requestPath === "/api/lpo") ||
    (request.method === "GET" && requestPath === "/api/lpo") ||
    (request.method === "GET" && requestPath === "/api/lpo/next")
  ) {
    await proxyGoogleRequest(request, response, requestPath);
    return;
  }

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
