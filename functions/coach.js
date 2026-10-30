"use strict";

const MAX_QUESTION_CHARS = 2000;
const MAX_CONTEXT_BYTES = 32 * 1024;
const MAX_OUTPUT_TOKENS = 900;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function validateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Corpo do pedido inválido." };
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return { error: "Escreve uma pergunta para o AI Coach." };
  if (question.length > MAX_QUESTION_CHARS) {
    return { error: `A pergunta deve ter no máximo ${MAX_QUESTION_CHARS} caracteres.` };
  }
  const context = body.context == null ? {} : body.context;
  if (typeof context !== "object" || Array.isArray(context)) {
    return { error: "O contexto enviado não é válido." };
  }
  let serializedContext;
  try {
    serializedContext = JSON.stringify(context);
  } catch (_) {
    return { error: "O contexto enviado não pode ser processado." };
  }
  if (Buffer.byteLength(serializedContext, "utf8") > MAX_CONTEXT_BYTES) {
    return { error: "O contexto é demasiado grande. Reduz os dados recentes e tenta novamente." };
  }
  return { question, context, serializedContext };
}

function extractAnswer(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  return candidates
    .flatMap(candidate => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
    .map(part => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function makePrompt(question, serializedContext) {
  return `Pergunta do utilizador:\n${question}\n\nContexto recente da app (JSON; pode estar incompleto):\n${serializedContext}`;
}

function createCoachHandler({ verifyIdToken, getApiKey, fetchImpl = fetch, logger = console }) {
  if (typeof verifyIdToken !== "function" || typeof getApiKey !== "function") {
    throw new TypeError("verifyIdToken e getApiKey são obrigatórios.");
  }

  return async function evolvefitAi(req, res) {
    res.set("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({ error: "Usa o método POST." });
    }

    const authorization = typeof req.get === "function"
      ? req.get("authorization")
      : req.headers?.authorization;
    const match = /^Bearer\s+(.+)$/i.exec(String(authorization || ""));
    if (!match) return res.status(401).json({ error: "É necessária uma sessão Firebase válida." });

    let user;
    try {
      user = await verifyIdToken(match[1]);
    } catch (_) {
      return res.status(401).json({ error: "A sessão Firebase expirou ou não é válida. Tenta novamente." });
    }
    if (!user?.uid) return res.status(401).json({ error: "A sessão Firebase não contém um utilizador válido." });

    const validated = validateInput(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });

    let apiKey;
    try {
      apiKey = String(getApiKey() || "").trim();
    } catch (_) {
      apiKey = "";
    }
    if (!apiKey) {
      logger.error("Gemini Cloud: GEMINI_API_KEY não está configurada no Secret Manager.");
      return res.status(503).json({ error: "O Gemini Cloud ainda não está configurado no servidor." });
    }

    const requestBody = {
      system_instruction: {
        parts: [{
          text: "És o AI Coach da EvolveFit e respondes em português europeu, com clareza e concisão. Usa apenas os dados fornecidos; distingue factos de estimativas e diz quando não há dados suficientes. Dá recomendações gerais e seguras de treino, recuperação e hábitos. Não diagnostiques doenças, não prescrevas tratamentos nem substituas um médico ou nutricionista. Se os dados sugerirem dor, lesão, sintomas ou risco clínico, recomenda avaliação por um profissional de saúde. Nunca afirmes que alteraste ou guardaste dados na app."
        }]
      },
      contents: [{ role: "user", parts: [{ text: makePrompt(validated.question, validated.serializedContext) }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetchImpl(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      if (!response.ok) {
        logger.error("Gemini Cloud upstream error", { status: response.status });
        const status = response.status === 429 ? 503 : 502;
        return res.status(status).json({ error: response.status === 429
          ? "O Gemini está temporariamente ocupado. Tenta novamente dentro de instantes."
          : "Não foi possível obter uma resposta do Gemini Cloud." });
      }
      const result = await response.json();
      const answer = extractAnswer(result);
      if (!answer) {
        logger.error("Gemini Cloud devolveu uma resposta vazia ou bloqueada.");
        return res.status(502).json({ error: "O Gemini não devolveu uma resposta de texto. Reformula a pergunta e tenta novamente." });
      }
      return res.status(200).json({ answer });
    } catch (error) {
      logger.error("Gemini Cloud request failed", {
        reason: error?.name === "AbortError" ? "timeout" : "network"
      });
      return res.status(502).json({ error: "Não foi possível contactar o Gemini Cloud. Tenta novamente." });
    } finally {
      clearTimeout(timeout);
    }
  };
}

module.exports = { createCoachHandler, extractAnswer, makePrompt, validateInput };
