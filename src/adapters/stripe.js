import { readJson } from '../lib/http.js';

export async function parseStripeWebhook(req) {
  return readJson(req, {});
}
