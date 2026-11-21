const form = document.querySelector("#query-form");
const refreshButton = document.querySelector("#refresh-button");
const updatedLabel = document.querySelector("#last-updated");

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setPanel(panelId, content) {
  document.querySelector(`#${panelId}`).replaceChildren(content);
}

function setPanelMessage(panelId, message, className = "empty-state") {
  setPanel(panelId, textElement("p", className, message));
}

function formatAmount(value) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 7 }).format(Number(value));
}

function assetName(record, side) {
  const code = record[`${side}_asset_code`];
  return code || (record[`${side}_asset_type`] === "native" ? "XLM" : "Credit asset");
}

async function getJson(path, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${path}?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function loadPanel(panelId, task, render) {
  setPanelMessage(panelId, "Loading…");
  try {
    render(await task());
  } catch (error) {
    setPanelMessage(panelId, error instanceof Error ? error.message : String(error), "error-state");
  }
}

function renderTrades(data) {
  const panel = document.createElement("div");
  const trades = data.records || [];
  panel.append(textElement("p", "count-label", `${trades.length} trades returned`));
  if (!trades.length) {
    panel.append(textElement("p", "empty-state", "No recent trades found for this account."));
    setPanel("trades-panel", panel);
    return;
  }

  const list = document.createElement("div");
  list.className = "trade-list";
  for (const trade of trades.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "trade-row";
    row.append(
      textElement("span", "trade-pair", `${assetName(trade, "base")} / ${assetName(trade, "counter")}`),
      textElement(
        "span",
        "trade-amount",
        `${formatAmount(trade.base_amount)} / ${formatAmount(trade.counter_amount)}`,
      ),
      textElement(
        "span",
        "trade-date",
        trade.ledger_close_time ? new Date(trade.ledger_close_time).toLocaleString() : "Recent",
      ),
    );
    list.append(row);
  }
  panel.append(list);
  setPanel("trades-panel", panel);
}

function renderOrderBook(data) {
  const columns = document.createElement("div");
  columns.className = "book-columns";
  for (const [side, title, rows] of [
    ["bid", "BIDS", data.bids || []],
    ["ask", "ASKS", data.asks || []],
  ]) {
    const column = document.createElement("div");
    column.className = `book-side ${side}`;
    column.append(textElement("p", "book-label", title));
    if (!rows.length) {
      column.append(textElement("p", "empty-state small", "No offers"));
    } else {
      for (const [index, row] of rows.slice(0, 5).entries()) {
        const line = document.createElement("div");
        line.className = "book-row";
        line.append(
          textElement("span", "", index === 0 ? "BEST" : ""),
          textElement("strong", "", row.price || "—"),
          textElement("span", "", formatAmount(row.amount)),
        );
        column.append(line);
      }
    }
    columns.append(column);
  }
  setPanel("orderbook-panel", columns);
}

function renderAsset(data) {
  const details = document.createElement("div");
  details.className = "metric-grid";
  details.append(
    textElement("span", "metric-label", "ASSET"),
    textElement("strong", "metric-value small-value", data.code),
    textElement("span", "metric-label", "HOLDERS"),
    textElement("strong", "metric-value", formatAmount(data.holders)),
    textElement("span", "metric-label", "SUPPLY"),
    textElement("strong", "metric-value", formatAmount(data.supply)),
  );
  setPanel("asset-panel", details);
}

function renderIssuer(data) {
  const details = document.createElement("div");
  details.append(
    textElement("p", "domain-value", data.homeDomain || "No home domain set"),
    textElement(
      "p",
      data.toml ? "toml-status loaded" : "toml-status",
      data.toml ? "Stellar TOML loaded" : "Stellar TOML unavailable",
    ),
  );
  if (data.toml) {
    const disclosure = document.createElement("details");
    disclosure.className = "toml-details";
    disclosure.append(textElement("summary", "", "View TOML"));
    disclosure.append(textElement("pre", "toml-text", data.toml));
    details.append(disclosure);
  }
  setPanel("issuer-panel", details);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const sellingCode = String(values.sellingCode || "").trim();
  const sellingIssuer = String(values.sellingIssuer || "").trim();
  const buyingCode = String(values.buyingCode || "").trim();
  const buyingIssuer = String(values.buyingIssuer || "").trim();
  const trackedAsset = buyingCode.toUpperCase() === "XLM"
    ? { code: sellingCode, issuer: sellingIssuer }
    : { code: buyingCode, issuer: buyingIssuer };
  const isCreditAsset = trackedAsset.code && trackedAsset.code.toUpperCase() !== "XLM";

  refreshButton.disabled = true;
  refreshButton.querySelector("span:first-child").textContent = "Loading…";
  updatedLabel.textContent = "Fetching public data";

  await Promise.all([
    loadPanel(
      "trades-panel",
      () => {
        const address = String(values.address || "").trim();
        if (!address) throw new Error("Enter an account address.");
        return getJson("/api/trades", { address, limit: "200" });
      },
      renderTrades,
    ),
    loadPanel(
      "orderbook-panel",
      () => getJson("/api/orderbook", {
        sellingCode,
        sellingIssuer,
        buyingCode,
        buyingIssuer,
        limit: "20",
      }),
      renderOrderBook,
    ),
    loadPanel(
      "asset-panel",
      () => {
        if (!isCreditAsset) throw new Error("Select a credit asset to view its supply and holders.");
        if (!trackedAsset.issuer) throw new Error("Enter a verified issuer for the selected asset.");
        return getJson("/api/asset", trackedAsset);
      },
      renderAsset,
    ),
    loadPanel(
      "issuer-panel",
      () => {
        if (!isCreditAsset || !trackedAsset.issuer) {
          throw new Error("Enter a credit asset and verified issuer to look up its domain.");
        }
        return getJson("/api/issuer", { issuer: trackedAsset.issuer });
      },
      renderIssuer,
    ),
  ]);

  refreshButton.disabled = false;
  refreshButton.querySelector("span:first-child").textContent = "Load market data";
  updatedLabel.textContent = `Updated ${new Date().toLocaleTimeString()}`;
});
