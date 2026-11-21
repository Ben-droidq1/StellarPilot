import "dotenv/config";

import { readFileSync } from "node:fs";
import { Asset, Horizon } from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.HORIZON_URL || "https://horizon.stellar.org";
const server = new Horizon.Server(HORIZON_URL);

const tradeFixture = JSON.parse(
  readFileSync(new URL("./fixtures/trades.json", import.meta.url), "utf8"),
);
const orderBookFixture = JSON.parse(
  readFileSync(new URL("./fixtures/orderbook.json", import.meta.url), "utf8"),
);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sumAmounts(amounts) {
  const scale = 10_000_000n;
  const total = amounts.reduce((sum, amount) => {
    const [whole, fraction = ""] = String(amount).split(".");
    if (!/^\d+$/.test(whole) || !/^\d{0,7}$/.test(fraction)) {
      throw new Error(`Unexpected Stellar amount: ${amount}`);
    }

    return sum + BigInt(whole) * scale + BigInt(fraction.padEnd(7, "0"));
  }, 0n);

  const whole = total / scale;
  const fraction = String(total % scale).padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function buildAsset(code, issuer) {
  return code.toUpperCase() === "XLM" ? Asset.native() : new Asset(code, issuer);
}

export async function getTrades(address, limit = 200) {
  try {
    const response = await server
      .trades()
      .forAccount(address)
      .limit(limit)
      .order("desc")
      .call();
    return response.records;
  } catch (error) {
    console.warn(
      `USING FIXTURE: Horizon getTrades failed for ${address}: ${errorMessage(error)}`,
    );
    return tradeFixture.records;
  }
}

export async function getOrderBook(sellingAsset, buyingAsset, limit = 20) {
  try {
    return await server
      .orderbook(sellingAsset, buyingAsset)
      .limit(limit)
      .call();
  } catch (error) {
    console.warn(`USING FIXTURE: Horizon getOrderBook failed: ${errorMessage(error)}`);
    return orderBookFixture;
  }
}

export async function getAsset(code, issuer) {
  try {
    const response = await server.assets().forCode(code).forIssuer(issuer).call();
    const asset = response.records.find(
      (record) => record.asset_code === code && record.asset_issuer === issuer,
    );
    if (!asset) {
      throw new Error(`Asset ${code}:${issuer} was not found on Horizon`);
    }

    return {
      code,
      issuer,
      holders:
        asset.accounts.authorized +
        asset.accounts.authorized_to_maintain_liabilities +
        asset.accounts.unauthorized,
      supply: sumAmounts([
        asset.balances.authorized,
        asset.balances.authorized_to_maintain_liabilities,
        asset.balances.unauthorized,
      ]),
    };
  } catch (error) {
    throw new Error(`Failed to get asset ${code}:${issuer}: ${errorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function getIssuerHomeDomain(issuer) {
  try {
    const account = await server.loadAccount(issuer);
    return account.home_domain || null;
  } catch (error) {
    throw new Error(`Failed to get issuer account ${issuer}: ${errorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function fetchToml(homeDomain) {
  try {
    const url = new URL(`https://${homeDomain}/.well-known/stellar.toml`);
    if (
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/.well-known/stellar.toml" ||
      url.hostname.toLowerCase() !== homeDomain.toLowerCase()
    ) {
      throw new Error("homeDomain must be a hostname only");
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.warn(`Could not fetch Stellar TOML for ${homeDomain}: ${errorMessage(error)}`);
    return null;
  }
}
