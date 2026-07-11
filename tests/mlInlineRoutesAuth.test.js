// Security regression guard for inline MercadoLibre routes in server/index.js.
// These routes expose seller/customer data or mutate live listings, so every
// one must keep the authOnly guard added in PR #656/#648.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  buildMlOrdersSearchQuery,
  buildMlQuestionsSearchQuery,
} from "../server/lib/mlInlineQuery.js";

const serverIndex = readFileSync(new URL("../server/index.js", import.meta.url), "utf8");

const sensitiveMlRoutes = [
  ["get", "/ml/users/me"],
  ["get", "/ml/users/:id"],
  ["get", "/ml/listings"],
  ["get", "/ml/items/:id"],
  ["patch", "/ml/items/:id"],
  ["post", "/ml/items/:id/description"],
  ["get", "/ml/questions"],
  ["get", "/ml/questions/:id"],
  ["post", "/ml/questions/:id/answer"],
  ["get", "/ml/orders"],
  ["get", "/ml/orders/:id"],
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeHasRequireMlAuth(method, route) {
  const pattern = new RegExp(
    `app\\.${method}\\(\\s*["'\`]${escapeRegex(route)}["'\`]\\s*,\\s*requireMlAuth\\s*,`,
    "m",
  );
  return pattern.test(serverIndex);
}

describe("inline /ml routes auth wiring", () => {
  it("keeps requireMlAuth as middleware on every sensitive inline ML route", () => {
    const missing = sensitiveMlRoutes.filter(([method, route]) => !routeHasRequireMlAuth(method, route));

    assert.deepEqual(
      missing,
      [],
      `Routes missing requireMlAuth: ${missing.map(([method, route]) => `${method.toUpperCase()} ${route}`).join(", ")}`,
    );
  });

  it("does not add new inline /ml routes without updating the auth guard list", () => {
    const inlineRoutes = [
      ...serverIndex.matchAll(/app\.(get|post|patch|put|delete)\(\s*["'`]\/ml\/[^"'`]+["'`]/g),
    ].map((match) => {
      const route = match[0].match(/["'`]([^"'`]+)["'`]/)?.[1];
      return [match[1], route];
    });

    assert.deepEqual(
      inlineRoutes,
      sensitiveMlRoutes,
      "Update this test when adding/removing inline /ml routes so auth is reviewed explicitly.",
    );
  });
});

describe("inline /ml route query sanitizers", () => {
  it("keeps /ml/questions/search query limited to MercadoLibre-supported keys", () => {
    const query = buildMlQuestionsSearchQuery({
      seller_id: "123",
      item_id: "MLU111",
      api_version: "",
      site_id: "MLU",
      status: "UNANSWERED",
      limit: "25",
      offset: "0",
      injected: "drop-me",
      access_token: "secret",
      nullish: null,
    });

    assert.deepEqual(query, {
      seller_id: "123",
      item_id: "MLU111",
      site_id: "MLU",
      status: "UNANSWERED",
      limit: "25",
      offset: "0",
    });
  });

  it("keeps /ml/orders/search query limited to MercadoLibre-supported keys", () => {
    const query = buildMlOrdersSearchQuery({
      seller: "456",
      "seller.id": "789",
      "order.status": "paid",
      sort: "date_desc",
      tags: "not_delivered",
      limit: "50",
      offset: "0",
      buyer: "drop-me",
      access_token: "secret",
      empty: "",
    });

    assert.deepEqual(query, {
      seller: "456",
      "seller.id": "789",
      "order.status": "paid",
      sort: "date_desc",
      tags: "not_delivered",
      limit: "50",
      offset: "0",
    });
  });
});
