// Fill in DEMO_ADDRESS and DEMO_ASSET_ISSUER with verified public Stellar values.
import {
  buildAsset,
  fetchToml,
  getAsset,
  getIssuerHomeDomain,
  getOrderBook,
  getTrades,
} from "./stellar.js";

const DEMO_ADDRESS = "TODO_FILL_STELLAR_ACCOUNT";
const DEMO_ASSET_CODE = "USDC";
const DEMO_ASSET_ISSUER = "TODO_FILL_VERIFIED_ISSUER";
let demoHomeDomain = null;

async function check(name, run) {
  try {
    const summary = await run();
    console.log(`PASS ${name}: ${summary}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

await check("getTrades", async () => {
  const trades = await getTrades(DEMO_ADDRESS);
  return `${trades.length} trades`;
});

await check("getOrderBook", async () => {
  const orderBook = await getOrderBook(
    buildAsset("XLM"),
    buildAsset(DEMO_ASSET_CODE, DEMO_ASSET_ISSUER),
  );
  const bestBid = orderBook.bids[0]
    ? `${orderBook.bids[0].price} (${orderBook.bids[0].amount})`
    : "none";
  const bestAsk = orderBook.asks[0]
    ? `${orderBook.asks[0].price} (${orderBook.asks[0].amount})`
    : "none";
  return `best bid ${bestBid}; best ask ${bestAsk}`;
});

await check("getAsset", async () => {
  const asset = await getAsset(DEMO_ASSET_CODE, DEMO_ASSET_ISSUER);
  return `${asset.holders} holders; supply ${asset.supply}`;
});

await check("getIssuerHomeDomain", async () => {
  demoHomeDomain = await getIssuerHomeDomain(DEMO_ASSET_ISSUER);
  return `home_domain ${demoHomeDomain ?? "null"}`;
});

await check("fetchToml", async () => {
  const toml = await fetchToml(demoHomeDomain ?? "stellar.org");
  return `TOML ${toml ? "loaded" : "not loaded"}`;
});

await check("buildAsset", async () => {
  const native = buildAsset("XLM");
  const credit = buildAsset(DEMO_ASSET_CODE, DEMO_ASSET_ISSUER);
  if (!native.isNative() || credit.isNative()) {
    throw new Error("Unexpected native or credit asset");
  }
  return "native XLM and credit asset constructed";
});
