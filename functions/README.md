# Gemini Cloud Function

This folder contains the server-side implementation used by the AI Coach. The browser sends a Firebase ID token plus the user's question and the limited recent context shown in the Coach privacy note. The Gemini API key is read only by the function from Firebase Secret Manager; never put it in `index.html`, Git, or chat.

## One-time Firebase setup

1. In Firebase Console for `evolvefit2-df25f`, enable **Authentication → Sign-in method → Anonymous**. The app obtains a Firebase ID token this way when there is no signed-in user.
2. Create a Gemini API key in Google AI Studio.
3. From a trusted terminal with Firebase CLI access, store it as a Firebase function secret:

   ```sh
   npx firebase-tools functions:secrets:set GEMINI_API_KEY --project evolvefit2-df25f
   ```

   Paste the key into the CLI prompt. It is not committed or sent to GitHub Actions.
4. Ensure the Firebase project is on the Blaze plan and the deploy identity has Cloud Functions, Cloud Build, Artifact Registry, and Secret Manager permissions.
5. Deploy once from an authenticated terminal:

   ```sh
   npx firebase-tools deploy --only functions:evolvefitAi --project evolvefit2-df25f
   ```

The function's URL matches the endpoint already used by the app: `https://us-central1-evolvefit2-df25f.cloudfunctions.net/evolvefitAi`.

## Ongoing deploys and tests

Changes under `functions/` trigger `.github/workflows/firebase-functions.yml` on `main`. That workflow uses the existing `FIREBASE_SERVICE_ACCOUNT_EVOLVEFIT2_DF25F` GitHub Actions secret. The Firebase Secret Manager secret above must already exist; the workflow never reads or uploads the Gemini key.

Run the isolated backend tests locally with:

```sh
npm ci --prefix functions
npm test --prefix functions
```

The endpoint requires `Authorization: Bearer <Firebase ID token>`, accepts POST JSON with `question` and `context`, limits prompt/context sizes, and returns `{ "answer": "..." }`. It does not log questions, health data, Gemini responses, or API keys.
