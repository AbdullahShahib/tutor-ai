# AI Learning Tutor — Physics MVP

Production-structured implementation of the blueprint: adaptive problem
practice, AI mistake diagnosis, and verified problem-variation generation.

## What's here

```
backend/                Fastify + TypeScript API, Prisma/Postgres, BullMQ workers
  src/services/adaptive.ts    Bayesian Knowledge Tracing + next-action logic (unit tested)
  src/services/claude.ts      Prompt A / Prompt B — real Anthropic API calls
  src/services/verification.ts  Client for the SymPy verification service
  src/workers/                 Async generation + diagnosis job consumers
  src/routes/                  auth, problems, attempts
  prisma/schema.prisma          Full DB schema from the design doc
verification-service/    FastAPI + SymPy — independently re-derives every
                          generated answer before it's stored or served
mobile/                  Expo (React Native + Web) client — login, the
                          practice loop, dashboard stub
docker-compose.yml       Wires Postgres + Redis + both services together
```

## Verified in this build

- `verification-service`: all three solvers (kinematics, Newton's second
  law, kinetic energy) checked against known values, then hit live over
  HTTP — confirmed it both passes a correct claimed answer and flags a
  wrong one.
- `backend`: full TypeScript type-check passes with zero errors.
  `src/services/adaptive.ts` (the BKT + decision logic) has a unit test
  suite — 8/8 passing — covering mastery updates, boundary clamping, and
  every branch of `decideNextAction` (advance / continue / remediate /
  escalate).

**Not runnable in this sandbox, by design of its network allowlist:**
`prisma generate` needs `binaries.prisma.sh`, which isn't on the sandbox's
allowed domains — it'll work immediately on your machine or CI. The mobile
app wasn't installed/built here (Expo's toolchain is large); the code
follows standard Expo Router + TypeScript conventions and should install
cleanly with `npm install`.

## Local setup

```bash
# 1. Start Postgres + Redis + the verification service
docker compose up postgres redis verification-service -d

# 2. Backend
cd backend
cp .env.example .env        # fill in ANTHROPIC_API_KEY, or leave
                             # USE_MOCK_LLM=true to develop without one
npm install
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev                 # http://localhost:4000

# 3. Mobile (separate terminal)
cd mobile
npm install
npx expo start              # press w for web, or scan the QR code
```

## Deploying

- **Backend + Postgres + Redis + verification-service**: `docker compose up
  --build` deploys all four as-is to Railway, Render, or Fly.io. Set
  `ANTHROPIC_API_KEY`, `JWT_SECRET`, and `USE_MOCK_LLM=false` as real
  secrets — the app refuses to boot in production with either missing
  (see `src/env.ts`).
- **Mobile**: `eas build` (iOS/Android) and `eas update` for OTA pushes;
  `expo export -p web` for the web build, deployable to Vercel/Netlify.
- Split `generationWorker` / `diagnosisWorker` into their own process once
  volume justifies it — they're already isolated modules, just moved out
  of `index.ts`'s bootstrap into their own entrypoint.

## Extending beyond the 3-concept MVP

1. Add seed problems via `prisma/seed.ts` or a real admin CRUD UI (Pillar 1).
2. Add `verification_type` handling in `verification-service/app.py` for
   each new concept — this is the one place that has to grow in lockstep
   with the seed bank, since the hallucination firewall is concept-specific
   by design.
3. Add a `GET /mastery` route mirroring `problems.ts`'s query pattern to
   power the dashboard screen.
