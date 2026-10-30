# Remoção do Gemini Cloud

A aplicação usa agora apenas o Coach local: o navegador calcula as respostas e não envia perguntas nem contexto para o Gemini. O endpoint, o consentimento, o código Firebase Functions, a configuração de Functions e o workflow de deploy foram removidos do repositório. Firebase Authentication, Firestore, sincronização da conta e o deploy de Hosting mantêm-se.

## Limpeza ainda necessária no projeto Firebase/GCP

A alteração do repositório não apaga recursos que já foram publicados. No Terminal do Mac, autenticado no projeto `evolvefit2-df25f`, executar:

```sh
npx firebase-tools functions:delete evolvefitAi --region us-central1 --project evolvefit2-df25f --force
gcloud secrets delete GEMINI_API_KEY --project=evolvefit2-df25f --quiet
```

O primeiro comando elimina a função Firebase `evolvefitAi` e o serviço Cloud Run associado. O segundo elimina o recurso Secret Manager e todas as suas versões. Se não tiveres o Google Cloud SDK (`gcloud`) instalado, elimina `GEMINI_API_KEY` no Console Google Cloud → Secret Manager, selecionando **Eliminar segredo** (não apenas desativar uma versão).

Estes comandos não desligam a faturação geral nem removem Firebase Authentication, Firestore ou Hosting. Não voltar a executar um deploy da função Gemini.
