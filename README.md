# Siznam & Co. — Team Occupancy

Internal occupancy app for **Siznam & Co.** Companies can manage team members, assign date-based project work, monitor occupancy and extra hours, and keep an audit trail of operational changes.

The home screen is who is working on what, for how many hours, on a chosen date.

Occupied hours are always calculated from **active assignments on that date**. They are never stored on the team member record. Extra hours are stored separately.

## Roles

There are exactly three application roles:

| Role    | Access |
| ------- | ------ |
| Admin   | Full access, including extra hours, settings, and security-sensitive actions |
| Manager | Team occupancy, projects, assignments, reports, audit logs (if permitted) |
| Member  | Own occupancy, own assignments, own extra hours, own reports |

Job titles such as **QA Engineer** are a `designation` field, not a permission role. Current team members are seeded as QA Engineer.

## Run it now (demo mode)

Until Firebase Auth users exist, the app can still run locally from this folder (ES modules will not run from `file://`):

```bash
npx --yes serve .
```

or:

```bash
python -m http.server 5173
```

Sign in:

| Role    | Email                   | Password          |
| ------- | ----------------------- | ----------------- |
| Admin   | admin@siznam.local      | Siznam!admin      |
| Manager | manager@siznam.local    | Siznam!manager    |
| Member  | member@siznam.local     | Siznam!member     |

The member login is linked to **Abdul Rafay**.

Demo data is stored in `localStorage` under `teamflow.demo.v2`. Reset it from **Settings → Reset demo data**.

## Architecture (POM)

```text
Page HTML
  → thin js/*.js bootstrap
    → js/pages/*Page.js
      → components / forms
        → js/services/*
          → store.js (demo localStorage | Firestore)
            → Firebase Auth + Firestore
```

Page Objects do not run Firestore queries. Occupancy math lives in `js/occupancy.js` only.

## Occupancy rules

```text
dailyOccupied   = SUM(active assignment hours for that date)
dailyExtraHours = SUM(extraHours for that date)
totalWork       = dailyOccupied + dailyExtraHours
available       = max(capacity - dailyOccupied, 0)
overCapacity    = max(totalWork - capacity, 0)
```

Negative “Available” hours are never shown. Over-capacity uses red **Xh Over Capacity**.

Only **Active** assignments count. Paused, completed, and cancelled assignments do not.

Assignments are date-based (`YYYY-MM-DD`, local date, not UTC). Extra hours are a separate collection.

## Connect Firebase

The app is wired to Firebase project **teamflowupdation**. Config lives in `js/firebase-config.js`. The vanilla app loads the Firebase JS SDK from the CDN — do **not** switch to `npm install firebase` unless you add a bundler.

Firebase Hosting URL: https://teamflowupdation.web.app

### First-time console steps

1. Enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Firestore** database (production mode is fine; rules are deployed from this repo).
3. Create the first Auth user: `admin@siznam.local` / `Siznam!admin` (must match `BOOTSTRAP_ADMIN_EMAIL` and `bootstrapEmail()` in `firestore.rules`).
4. Deploy rules, indexes, and Hosting:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use teamflowupdation
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,hosting
```

5. Sign in once as that admin. The rules allow that email to create its own `users/{uid}` admin profile.
6. In **Settings**, load demo data into Firestore if you want the sample roster.

### Vercel

Framework Preset **Other**, Root Directory `./` (this folder contains `index.html`). Do not add Firebase keys as Vercel env vars — this app has no build step to inject them. After the Vercel URL exists, add it under Firebase Authentication → Settings → Authorized domains.

Frontend hiding is not the only control: Firestore rules also enforce Admin / Manager / Member, `manageExtraHours`, `assignMember`, and the other permission flags. Role is stored on `users/{uid}` (not Auth custom claims).

## Permissions (managers)

| Key                   | Default |
| --------------------- | ------- |
| createProject         | on      |
| editProject           | on      |
| archiveProject        | off     |
| assignMember          | on      |
| editAssignmentHours   | on      |
| removeAssignment      | on      |
| allowOverCapacity     | on      |
| manageExtraHours      | off     |
| viewAuditLogs         | on      |
| manageTeam            | off     |

Admin always has every permission. Only Admin can add extra hours unless `manageExtraHours` is enabled for a manager. Only Admin and Manager can create assignments. Members are read-only.

## Folder structure

```text
.
├── index.html
├── login.html
├── pages/
├── css/
├── js/
│   ├── pages/
│   ├── services/
│   ├── occupancy.js
│   ├── store.js
│   └── firebase-config.js
├── vercel.json
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```
