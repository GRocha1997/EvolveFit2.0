"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCoachHandler, extractAnswer, validateInput } = require("../coach");

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function requestMock({ method = "POST", token = "valid-token", body } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    get(name) { return this.headers[String(name).toLowerCase()]; },
    body: body || { question: "Como está a minha progressão?", context: { sessions: [] } }
  };
}

const quietLogger = { error() {} };

test("validates question and bounded context", () => {
  assert.equal(validateInput({ question: " Olá ", context: { days: 7 } }).question, "Olá");
  assert.match(validateInput({ question: " " }).error, /pergunta/i);
  assert.match(validateInput({ question: "x".repeat(2001) }).error, /2000/);
  assert.match(validateInput({ question: "Olá", context: { value: "x".repeat(33 * 1024) } }).error, /grande/i);
});

test("extracts and joins Gemini text parts", () => {
  assert.equal(extractAnswer({ candidates: [{ content: { parts: [{ text: "Olá." }, { text: "Continua." }] } }] }), "Olá.\nContinua.");
  assert.equal(extractAnswer({ candidates: [] }), "");
});

test("requires a verified Firebase user before contacting Gemini", async () => {
  let fetched = false;
  const handler = createCoachHandler({
    verifyIdToken: async () => { throw new Error("invalid token"); },
    getApiKey: () => "not-used",
    fetchImpl: async () => { fetched = true; },
    logger: quietLogger
  });
  const res = responseMock();
  await handler(requestMock(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(fetched, false);
});

test("rejects non-POST requests", async () => {
  const handler = createCoachHandler({ verifyIdToken: async () => ({ uid: "u1" }), getApiKey: () => "key", logger: quietLogger });
  const res = responseMock();
  await handler(requestMock({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("uses the Secret Manager key only in the Gemini request header", async () => {
  const apiKey = "test-secret-do-not-return";
  let upstreamRequest;
  const handler = createCoachHandler({
    verifyIdToken: async token => ({ uid: token === "valid-token" ? "user-1" : null }),
    getApiKey: () => apiKey,
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Resposta Gemini." }] } }] }) };
    },
    logger: quietLogger
  });
  const res = responseMock();
  await handler(requestMock(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { answer: "Resposta Gemini." });
  assert.equal(upstreamRequest.options.headers["x-goog-api-key"], apiKey);
  assert.equal(upstreamRequest.options.body.includes(apiKey), false);
  assert.match(upstreamRequest.url, /gemini-2\.5-flash:generateContent$/);
});

test("reports a missing Secret Manager key without making an upstream request", async () => {
  let fetched = false;
  const handler = createCoachHandler({
    verifyIdToken: async () => ({ uid: "user-1" }),
    getApiKey: () => "",
    fetchImpl: async () => { fetched = true; },
    logger: quietLogger
  });
  const res = responseMock();
  await handler(requestMock(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(fetched, false);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("does not disclose upstream errors or the API key to the client", async () => {
  const apiKey = "test-secret-do-not-return";
  const handler = createCoachHandler({
    verifyIdToken: async () => ({ uid: "user-1" }),
    getApiKey: () => apiKey,
    fetchImpl: async () => ({ ok: false, status: 429, text: async () => apiKey }),
    logger: quietLogger
  });
  const res = responseMock();
  await handler(requestMock(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.stringify(res.body).includes(apiKey), false);
});
