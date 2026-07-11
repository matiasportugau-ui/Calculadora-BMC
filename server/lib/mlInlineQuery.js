export const ML_QUESTIONS_SEARCH_ALLOWED_KEYS = Object.freeze([
  "seller_id",
  "item",
  "item_id",
  "api_version",
  "site_id",
  "offset",
  "limit",
  "status",
]);

export const ML_ORDERS_SEARCH_ALLOWED_KEYS = Object.freeze([
  "seller",
  "seller.id",
  "offset",
  "limit",
  "order.status",
  "sort",
  "tags",
]);

export function pickAllowedMlQueryParams(source = {}, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  const query = {};

  for (const [key, value] of Object.entries(source || {})) {
    if (allowed.has(key) && value != null && String(value) !== "") {
      query[key] = value;
    }
  }

  return query;
}

export function buildMlQuestionsSearchQuery(source = {}) {
  return pickAllowedMlQueryParams(source, ML_QUESTIONS_SEARCH_ALLOWED_KEYS);
}

export function buildMlOrdersSearchQuery(source = {}) {
  return pickAllowedMlQueryParams(source, ML_ORDERS_SEARCH_ALLOWED_KEYS);
}
