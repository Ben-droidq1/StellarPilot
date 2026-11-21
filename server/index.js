import "dotenv/config";

import express from "express";
import { fileURLToPath } from "node:url";
import {
  buildAsset,
  fetchToml,
  getAsset,
  getIssuerHomeDomain,
  getOrderBook,
  getTrades,
} from "./stellar.js";

const app = express();
const publicDirectory = fileURLToPath(new URL("../public", import.meta.url));

app.disable("x-powered-by");
app.use(express.static(publicDirectory));

class RequestError extends Error {
  statusCode = 400;
}

function requiredQuery(req, name) {
  const value = req.query[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`Missing required query parameter: ${name}`);
  }
  return value.trim();
}

function queryLimit(req, fallback, maximum) {
  if (req.query.limit === undefined) return fallback;
  const limit = Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) {
    throw new RequestError(`limit must be an integer from 1 to ${maximum}`);
  }
  return limit;
}

function assetFromQuery(req, prefix) {
  const code = requiredQuery(req, `${prefix}Code`);
  const issuer = typeof req.query[`${prefix}Issuer`] === "string"
    ? req.query[`${prefix}Issuer`].trim()
    : "";
  if (code.toUpperCase() !== "XLM" && !issuer) {
    throw new RequestError(`${prefix}Issuer is required for non-native assets`);
  }
  try {
    return buildAsset(code, issuer);
  } catch (error) {
    throw new RequestError(
      `Invalid ${prefix.toLowerCase()} asset: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function api(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      const status = error instanceof RequestError ? error.statusCode : 502;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`API ${req.path} failed: ${message}`);
      res.status(status).json({ error: message });
    }
  };
}

app.get(
  "/api/trades",
  api(async (req) => {
    const address = requiredQuery(req, "address");
    const limit = queryLimit(req, 200, 200);
    return { records: await getTrades(address, limit) };
  }),
);

app.get(
  "/api/orderbook",
  api(async (req) => {
    const sellingAsset = assetFromQuery(req, "selling");
    const buyingAsset = assetFromQuery(req, "buying");
    const limit = queryLimit(req, 20, 200);
    return await getOrderBook(sellingAsset, buyingAsset, limit);
  }),
);

app.get(
  "/api/asset",
  api(async (req) => {
    return await getAsset(requiredQuery(req, "code"), requiredQuery(req, "issuer"));
  }),
);

app.get(
  "/api/issuer",
  api(async (req) => {
    const issuer = requiredQuery(req, "issuer");
    const homeDomain = await getIssuerHomeDomain(issuer);
    const toml = homeDomain ? await fetchToml(homeDomain) : null;
    return { homeDomain, toml };
  }),
);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Stellar read-only dashboard: http://${host}:${port}`);
});
