# AttendX – Smart Event Attendance Platform
## PromptWars Virtual Submission Plan (5 Days)

**Goal:** Build a fraud-proof, multi-round attendance tracking web app for college events with dynamic QR, volunteer scanning dashboard, and auto certificate eligibility.

**Architecture:** Next.js 14 frontend + Firebase (Firestore + Auth) backend. Dynamic QR per participant stored in Firestore. Volunteer dashboard uses camera to scan QR and records check-ins per round. Cloud Run deployment.

**Tech Stack:** Next.js 14, Firebase Firestore, Firebase Auth, `qrcode` npm, `html5-qrcode` for scanning, Tailwind CSS, Docker + Cloud Run

---

## Day 1 — Project Setup + Auth + Event Creation

### Milestone: Organizer can log in and create an event

---

### Task 1: Project Scaffold

**Antigravity Prompt:**
```
Create a Next.js 14 app called "attendx" using the App Router. Install and configure:
- Firebase (firestore, auth)
- Tailwind CSS
- qrcode (npm)
- html5-qrcode (npm)
- shadcn/ui (button, input, card, badge)

Create a .env.local with placeholders:
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

Create lib/firebase.ts that initializes Firebase app, Firestore, and Auth and exports them.
```

---

### Task 2: Auth – Google Sign In

**Antigravity Prompt:**
```
In the attendx Next.js app, create:
- lib/auth.ts with signInWithGoogle() using Firebase GoogleAuthProvider and signOut()
- app/login/page.tsx with a centered "Sign in with Google" button using shadcn Button
- A context provider in context/AuthContext.tsx that wraps the app, exposes { user, loading }
- Middleware in middleware.ts that redirects unauthenticated users to /login for all routes except /login and /scan/[eventId]

Use Firebase Auth onAuthStateChanged to track session.
```

---

### Task 3: Event Creation

**Antigravity Prompt:**
```
In attendx, create:

Firestore data model:
- Collection: events
  - id (auto)
  - name: string
  - description: string
  - organizerId: string (uid)
  - rounds: string[] (e.g. ["Entry", "Round 1", "Finals", "Exit"])
  - createdAt: timestamp

- app/dashboard/page.tsx
  - Shows list of events created by the logged-in organizer
  - "Create Event" button opens a modal/form with fields: Event Name, Description, Rounds (comma-separated)
  - On submit, writes to Firestore events collection
  - Shows event cards with name, date, round count

- lib/events.ts with:
  - createEvent(data) → writes to Firestore
  - getOrganizerEvents(uid) → queries events by organizerId
```

---

## Day 2 — Participant Management + Dynamic QR Generation

### Milestone: Organizer can add participants and each gets a unique QR code

---

### Task 4: Participant Addition

**Antigravity Prompt:**
```
In attendx, create:

Firestore data model:
- Collection: events/{eventId}/participants
  - id (auto)
  - name: string
  - email: string
  - participantCode: string (UUID v4, generated on creation)
  - createdAt: timestamp

- app/dashboard/[eventId]/page.tsx
  - Shows event details and list of participants
  - "Add Participant" button opens a form: Name, Email
  - On submit, generates a UUID v4 as participantCode, writes to Firestore
  - Also support CSV bulk upload: parse CSV with columns name,email and batch write participants

- lib/participants.ts with:
  - addParticipant(eventId, name, email) → generates UUID, writes to Firestore
  - bulkAddParticipants(eventId, csvText) → parses CSV, batch writes
  - getParticipants(eventId) → fetches all participants for event
```

---

### Task 5: QR Code Generation

**Antigravity Prompt:**
```
In attendx, in app/dashboard/[eventId]/page.tsx:

For each participant in the list:
- Generate a QR code using the `qrcode` npm package
- The QR data should be a JSON string: { participantCode, eventId }
- Display a small QR image next to each participant row
- Add a "Download QR" button per participant that downloads the QR as a PNG
- Add a "Download All QRs" button that generates a zip of all participant QRs using jszip

In lib/qr.ts:
- generateQRDataURL(participantCode, eventId) → returns base64 data URL
```

---

## Day 3 — Volunteer Scanning Dashboard

### Milestone: Volunteer can scan QR codes and mark attendance per round

---

### Task 6: Volunteer Scan Page

**Antigravity Prompt:**
```
In attendx, create app/scan/[eventId]/page.tsx (publicly accessible, no auth required):

- Fetches event details from Firestore (event name, rounds array)
- Shows a round selector: dropdown or tab buttons for each round in event.rounds
- Uses html5-qrcode to activate the camera and scan QR codes
- On successful scan:
  - Parse JSON from QR: { participantCode, eventId }
  - Validate eventId matches current event
  - Call lib/attendance.ts → recordAttendance(eventId, participantCode, round)
  - Show success toast: "✅ [Name] checked in for [Round]"
  - Show error toast for: duplicate scan, invalid QR, wrong event

Visual:
- Dark themed, mobile-first (volunteers use phones)
- Large camera viewfinder
- Last 5 scans shown below camera
```

---

### Task 7: Attendance Recording + Fraud Detection

**Antigravity Prompt:**
```
In attendx, create lib/attendance.ts:

Firestore data model:
- Collection: events/{eventId}/attendance
  - id: auto
  - participantCode: string
  - round: string
  - scannedAt: timestamp
  - status: "valid" | "duplicate" | "invalid"

recordAttendance(eventId, participantCode, round):
1. Verify participantCode exists in events/{eventId}/participants
2. Check if a record already exists for same participantCode + round → if yes, write status: "duplicate" and throw error "Already checked in for this round"
3. If valid, write attendance record with status: "valid"
4. Return participant name

Also create getAttendance(eventId) → fetches all attendance records for organizer dashboard
```

---

## Day 4 — Organizer Dashboard + Certificate Eligibility

### Milestone: Organizer sees full attendance report and certificate eligibility per participant

---

### Task 8: Attendance Dashboard

**Antigravity Prompt:**
```
In attendx, in app/dashboard/[eventId]/page.tsx add an "Attendance" tab:

- Fetch all attendance records for the event
- Show a table: Participant Name | Email | Rounds Attended | Certificate Eligible | Attendance %
- Certificate eligible = attended all rounds defined in event.rounds (or configurable threshold)
- Color code rows: green = eligible, yellow = partial, red = absent
- Show stats at top: Total Participants, Total Check-ins, Certificate Eligible count
- Add "Export CSV" button that downloads the attendance report

In lib/eligibility.ts:
- computeEligibility(participants, attendanceRecords, rounds, threshold=1.0)
  → returns map of participantCode → { roundsAttended[], eligible: boolean, percentage }
```

---

### Task 9: Participant Self-View Page

**Antigravity Prompt:**
```
In attendx, create app/p/[participantCode]/page.tsx (public, no auth):

- Fetch participant data + their attendance records for all events
- Show: Name, Email, list of events attended, rounds completed per event, certificate eligibility status
- If eligible, show a green "Certificate Eligible" badge
- This is the participant's proof-of-attendance page they can share
```

---

## Day 5 — Deploy + Blog + LinkedIn

### Milestone: Live on Cloud Run, submitted on platform

---

### Task 10: Dockerize + Cloud Run Deploy

**Antigravity Prompt:**
```
In attendx Next.js 14 app, create a production-ready Dockerfile:
- Use node:20-alpine
- Multi-stage build: builder stage runs next build, runner stage serves it
- Expose port 3080
- Set NODE_ENV=production
- Output should be standalone (next.config.js output: 'standalone')

Also create:
- .dockerignore excluding node_modules, .next, .env.local
- cloudbuild.yaml for Google Cloud Build that:
  1. Builds the Docker image
  2. Pushes to Google Container Registry
  3. Deploys to Cloud Run in us-central1 with --allow-unauthenticated

Write the exact gcloud commands to:
1. Enable required APIs
2. Build and push image
3. Deploy to Cloud Run
4. Set environment variables on Cloud Run from .env.local values
```

---

### Task 11: Blog Post Draft

**Antigravity Prompt:**
```
Write a technical blog post for dev.to / Hashnode titled:
"I built a fraud-proof event attendance system in 5 days using Google Antigravity"

Structure:
- The Problem: proxy attendance, duplicate entries, fake certificate claims at college events
- The Solution: AttendX — dynamic QR + multi-round scanning + auto certificate eligibility
- How I built it: Next.js 14 + Firebase + html5-qrcode, deployed on Cloud Run
- Key challenges: real-time duplicate detection, mobile-first volunteer scanner
- What Google Antigravity enabled: describe how prompts replaced manual coding
- Demo: link to live app
- GitHub: link to repo
- What's next: location validation, email certificates, multi-organizer support

Tone: builder-in-public, first person, technical but readable. ~800 words.
```

---

### Task 12: LinkedIn Post

**Antigravity Prompt:**
```
Write a LinkedIn post for PromptWars Virtual submission. 

Context:
- Built AttendX: a smart attendance platform for college events
- Solves proxy attendance, duplicate entries, fake certificate claims
- Features: dynamic QR per participant, volunteer scan dashboard, multi-round tracking, auto certificate eligibility
- Built in 5 days using Google Antigravity + Next.js + Firebase, deployed on Cloud Run
- Built by Mohan Prasath, 1st year CSE AI/ML student, President of Gen AI Club at NIAT × Crescent

Format:
- Hook line (problem statement)
- What I built (2-3 lines)
- Tech used
- Link to live app and GitHub
- Hashtags: #PromptWars #BuildWithAI #GoogleAntigravity #VibeCoding #GenAI
```

---

## Submission Checklist

- [ ] Public GitHub repo link
- [ ] Cloud Run deployed URL
- [ ] LinkedIn post URL
- [ ] All 3 submitted on vision.hack2skill.com before April 19, 11:59 PM IST

---

## AI Scoring Criteria (from dashboard)

| Criteria | How AttendX covers it |
|---|---|
| Code Quality | Clean Next.js App Router structure, typed with TypeScript |
| Security | Firebase Auth, Firestore rules, no exposed keys |
| Efficiency | Firestore queries optimized, duplicate check before write |
| Testing | Edge cases: duplicate scan, invalid QR, wrong event |
| Accessibility | Mobile-first, shadcn components, toast feedback |
| Google Services | Firebase (Firestore + Auth) + Cloud Run |
