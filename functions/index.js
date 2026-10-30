"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { defineSecret } = require("firebase-functions/params");
const { onRequest } = require("firebase-functions/v2/https");
const { createCoachHandler } = require("./coach");

initializeApp();
const geminiApiKey = defineSecret("GEMINI_API_KEY");

const allowedOrigins = [
  "https://evolvefit2-df25f.web.app",
  "https://evolvefit2-df25f.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

exports.evolvefitAi = onRequest({
  region: "us-central1",
  cors: allowedOrigins,
  timeoutSeconds: 60,
  memory: "256MiB",
  concurrency: 8,
  maxInstances: 3,
  secrets: [geminiApiKey]
}, createCoachHandler({
  verifyIdToken: token => getAuth().verifyIdToken(token),
  getApiKey: () => geminiApiKey.value()
}));
