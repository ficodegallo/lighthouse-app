# Lighthouse

**An AI-powered memory companion for people living with Alzheimer's.**

Lighthouse helps patients hold on to what matters — daily appointments, cherished memories, and the people they love — through gentle voice capture, intelligent organization, and a warm morning briefing delivered every day.

---

## What It Does

- **Voice & text memory capture** — Tap the floating mic button and speak naturally. Lighthouse uses Claude AI to classify and summarize what you said (appointment, routine, life memory, quick note, or person).
- **Morning briefing** — Every morning, a personalized AI-written summary of today's schedule, the week ahead, and a meaningful life memory is read aloud in a warm voice.
- **Ask Lighthouse** — Type or speak a question ("What's happening today?" / "Who is Dr. Patel?") and get a conversational, grounded answer drawn from your memories.
- **People directory** — A contact-style directory of important people, built automatically from things like "David is my son" or "Dr. Patel is my cardiologist."
- **Care circle** — A caregiver can be invited to add and manage memories on behalf of the patient, with transparent attribution ("Added by David").
- **Smart reminders** — Time-based reminders for appointments and medications, with caregiver escalation if unacknowledged.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 54 (iOS-first, Expo Go compatible) |
| Backend | Node.js + TypeScript + Express on AWS ECS Fargate |
| Database | PostgreSQL (AWS RDS) + pgvector for semantic search |
| Auth | AWS Cognito (JWT, patient + caregiver roles) |
| AI / NLP | Claude API (`claude-sonnet-4-6`) — IntakeAgent, BriefingComposerAgent, QueryAgent |
| TTS | ElevenLabs API (server-side, Sprint 4) |
| Storage | AWS S3 (audio briefings, encrypted at rest) |
| Push | Expo Push Notifications → AWS SNS |
| Monorepo | Turborepo + npm workspaces |
| IaC | AWS CDK (TypeScript) |

---

## Project Structure

```
lighthouse-app/
  apps/
    mobile/                     # Expo React Native app
      app/
        (tabs)/
          index.tsx             # Home — greeting, today snapshot, Ask Lighthouse
          memories.tsx          # Browse — Today / This Week / Life / People tabs
          briefing.tsx          # Morning briefing player (Sprint 4)
          settings.tsx          # Preferences + care circle management
        capture.tsx             # Voice/text memory capture modal
      src/
        components/             # MemoryCard, FloatingMicButton
        hooks/                  # useVoiceCapture (stub mode for Expo Go)
        services/               # API client (typed fetch wrapper)
        store/                  # Zustand stores (memoryStore)
        theme/                  # Colors, typography, spacing
    api/                        # Node.js/TypeScript Express backend
      src/
        agents/
          IntakeAgent.ts        # Classifies captured text → MemoryDraft
          QueryAgent.ts         # Answers natural-language questions from memories
        routes/
          memories.ts           # CRUD + /classify + /query endpoints
          briefings.ts          # Briefing delivery + audio tracking
          users.ts              # Registration, profile
          caregivers.ts         # Care circle invite + accept
          reminders.ts          # Reminder acknowledgment
        jobs/
          briefingJob.ts        # Daily 5 AM cron — BriefingComposerAgent + TTS
          reminderJob.ts        # Every-5-min cron — trigger pending reminders
          expiryJob.ts          # Daily midnight — expire QuickNotes, archive past Events
        middleware/
          auth.ts               # Cognito JWT verification + dev bypass
          audit.ts              # HIPAA audit log on every request
          errorHandler.ts
        lib/
          prisma.ts             # Prisma client singleton
          errors.ts             # Typed HTTP errors
          logger.ts             # Structured JSON logger
      prisma/
        schema.prisma           # Full data model
  packages/
    shared/                     # Shared TypeScript types (Memory, Briefing, User, etc.)
  infrastructure/               # AWS CDK stack (ECS, RDS, S3, Cognito, CloudWatch)
```

---

## Data Model

```
User         id, cognitoId, name, email, role (patient|caregiver),
             briefingTime, speechRate, voiceId, complexityLevel, timezone

Memory       id, userId, content, type (Event|Routine|LifeMemory|QuickNote|Person),
             horizon (Today|ThisWeek|Always), summary, createdBy, attributionLabel,
             status (active|archived|expired|flagged), expiresAt, embedding (pgvector)

Person       id, userId, name, relationship, photoUrl, notes

Briefing     id, userId, date, fullText, sectionsJson, audioUrl, audioS3Key,
             deliveredAt, openedAt, audioPlayedAt

CareCircle   id, patientId, caregiverId, role (admin|contributor|viewer), inviteToken

Reminder     id, memoryId, userId, triggerAt, type, status, escalationLevel, message

AuditLog     id, userId, action, resourceId, resourceType, actorId, ipAddress
```

---

## AI Agent Pipeline

### IntakeAgent
Takes raw transcript or text → calls `claude-sonnet-4-6` → returns structured `MemoryDraft` with type, horizon, warm first-person summary, extracted datetime, and person names. Called on every memory capture submission.

### QueryAgent
Takes a natural language question + user's active memories → calls `claude-sonnet-4-6` → returns a warm, grounded conversational answer. Called on-demand from the home screen query input.

### BriefingComposerAgent *(Sprint 4)*
Daily cron at 5 AM → fetches active memories → generates a three-section morning briefing (Today / This Week / Remember) → passes text to ElevenLabs TTS → uploads audio to S3 → stores signed URL in Briefing record.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop (for local PostgreSQL)
- Expo Go app on your iPhone (iOS-first development)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
# Fill in: ANTHROPIC_API_KEY, DATABASE_URL (already set for local Docker)
```

### 4. Run database migrations

```bash
cd apps/api
npx prisma migrate dev --name init
cd ../..
```

### 5. Start the API

```bash
npm run dev --workspace=apps/api
```

### 6. Configure the mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Set EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_IP:3000
# Find your IP: ipconfig (Windows) or ifconfig (Mac)
```

### 7. Start the mobile app

```bash
cd apps/mobile
npx expo start --lan
# Scan the QR code with Expo Go on your iPhone
```

> **Note:** Voice capture runs in stub/demo mode in Expo Go (no native speech recognition). A custom dev build is required for real STT.

---

## Development Notes

### Dev auth bypass
In development (`NODE_ENV !== 'production'`), any request without a real Bearer token is automatically authenticated as a local dev patient (`dev@lighthouse.local`). This path is unreachable in production.

### Memory classification flow
1. User speaks or types → mobile sends content to `POST /api/memories/classify`
2. IntakeAgent calls Claude → returns type/horizon/summary
3. Confirmation card shown: "I captured: [summary]. Is this right?"
4. User taps Save → `POST /api/memories` saves the confirmed memory

### Caregiver attribution
When a caregiver creates a memory, the API sets `attributionLabel = "Added by [name]"`. This is displayed on the MemoryCard so the patient always knows who added what.

---

## Sprint Progress

| Sprint | Focus | Status |
|---|---|---|
| 1 | Foundation — monorepo, DB, auth, infra skeleton | Complete |
| 2 | Memory capture — voice stub, IntakeAgent, confirmation card | Complete |
| 3 | Browse, QueryAgent, People directory, care circle UI | Complete |
| 4 | Morning briefing — BriefingComposerAgent, ElevenLabs TTS, push notifications | Planned |
| 5 | Reminders — time-based, escalation to caregiver | Planned |
| 6 | Accessibility polish, offline support, TestFlight | Planned |

---

## HIPAA Considerations

This app is designed for real patient data and targets HIPAA compliance from day one:

- All data encrypted at rest (RDS encryption, S3 SSE) and in transit (TLS 1.2+)
- Cognito JWT auth required on every API endpoint
- Audit log on every read/write to patient data (userId, action, timestamp, resource)
- Voice recordings deleted after transcription — not stored
- Role-based access enforced server-side
- No PII in application logs or error messages
- AWS BAA to be signed before any real patient data is processed

---

## License

Private — all rights reserved.
