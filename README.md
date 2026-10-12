<div align="center">

# 🐝 DriveHive

**The social hive for car enthusiasts.**

Post your build. Find the next meet. Get straight answers from real mechanics.

[![React](https://img.shields.io/badge/React-19-000?logo=react&logoColor=FACC15)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-000?logo=fastapi&logoColor=FACC15)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Motor-000?logo=mongodb&logoColor=FACC15)](https://www.mongodb.com)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-000?logo=stripe&logoColor=FACC15)](https://stripe.com)
[![License](https://img.shields.io/badge/license-MIT-FACC15?logoColor=000)](#license)

</div>

---

## What is it?

I built DriveHive because car people deserve a place made for them: post your build, find the next meet, and ask a real mechanic when something sounds wrong. It's a full-stack social network with a black / yellow / white "bee hive" look on top of an Instagram-style feed. Here's what I built into it:

- 🏁 **Live feed** of builds and meet recaps from other riders
- 📸 **Stories** (photos + videos) that auto-expire in 24 hours, with an in-app Instagram-style viewer
- 🗓️ **Events** — user-hosted car meets with a paid **⚡ Boost** option (Stripe-powered)
- 🔧 **Mechanic DMs** — message people who signed up as mechanics for quick advice
- 👥 **Crew DMs** — chat with any rider you follow or who follows you
- 🔔 Notifications, 🔍 search, ❤️ likes, 💬 comments, ↗️ share-to-crew, 👤 follow / unfollow

---

## Live demo

**▶ Try it:** _coming soon — `https://<your-app>.vercel.app`_

Tap **Try the demo** on the login screen and you're in, no sign-up. I set up the demo account with sample builds, upcoming meets, stories and a mechanic DM thread, and the app re-seeds them whenever the server restarts, so it never looks empty.

| Demo login | |
|---|---|
| Email | `demo@drivehive.app` |
| Password | `drivehive-demo` |

> I host the API on a free server that sleeps when nobody's using it. The first visit after a quiet spell shows a "waking up the server (~30s)" banner, then everything is fast.
>
> Boost payments run in **demo mode** unless a Stripe test key is configured, so nobody can be charged.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS, shadcn/ui, [@phosphor-icons/react](https://phosphoricons.com), Sonner toasts |
| Backend  | FastAPI (`/api` prefix), Motor (async MongoDB), bcrypt, PyJWT |
| Database | MongoDB (`drivehive_db`) |
| Storage  | MongoDB GridFS (post photos, story photos/videos, avatars live in the same database) |
| Payments | Stripe Checkout (official `stripe` Python SDK) for Featured Meet boosts |
| Auth     | bcrypt passwords + JWT. The token is sent as an `Authorization: Bearer` header (works in iPhone Safari, which blocks cross-site cookies); httpOnly `SameSite=None; Secure` cookies are set too |
| Hosting  | Vercel (frontend) · Render free web service (API) · MongoDB Atlas M0 (database) |
| Fonts    | Clash Display (display) · Manrope (body) · JetBrains Mono (meta) |

---

## Features

### Feed
- Instagram-style stories tray at the top (yellow conic ring = unviewed, grey = seen)
- Post cards with photo, caption, ❤️ "revs" count, comment drawer, share sheet
- Create a post with the floating **+** button
- Tap **Add to story** for a photo or video (mp4 / webm / mov, up to 60 MB)

### Story viewer
- Opens **in the same window** as a full-screen modal
- Per-story progress bars, tap-left / tap-right navigation, arrow keys, Escape to close
- Images auto-advance every 5 s; videos play for their full native duration
- Pause button, like button, "viewed by N" indicator for your own stories

### Events
- User-hosted car meets with cover image, date badge, location, description
- **Featured strip** at the top of the grid pins boosted meets with a ⭐ badge + countdown
- Hosts can **⚡ Boost** their own meet via Stripe Checkout — $4.99 / 7 d or $14.99 / 30 d
- Idempotent payment fulfillment (safe against double-polling / webhook replays)

### Mechanics
- Directory of registered mechanic users with specialty tags
- One tap "Send a question" → DM thread

### Messages
- 1-to-1 DMs with anyone you follow or who follows you (not just mechanics)
- Conversation list + thread view with auto-scroll
- Share-to-DM from the Share Sheet — text arrives with the post link + caption

### Profile
- Editable name / bio / specialty / avatar
- Follower / following counts, Follow + Message buttons when viewing someone else
- Posts grid with delete-on-hover for your own posts

### Notifications
- Bell icon in the topbar with unread badge
- Triggers: like, comment, follow, message, share, story like
- Auto-polled every 20 s; click to open the panel + mark read

### Search
- Global debounced search in the topbar for people (by name / email / specialty) and posts (by caption)

---

## Project structure

```
DriveHive/
├── render.yaml                # Render blueprint for the API (free web service)
├── backend/
│   ├── server.py              # All FastAPI routes (auth, posts, stories, events, messages, payments, storage, search)
│   ├── seed.py                # Idempotent demo data (demo account, posts, meets, stories, DMs)
│   ├── storage.py             # Uploads stored in MongoDB GridFS
│   ├── stripe_checkout.py     # Stripe Checkout helper (Boost)
│   ├── requirements.txt       # Runtime deps only (requirements-dev.txt adds pytest)
│   ├── tests/                 # pytest suites
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── context/AuthContext.jsx
│   │   ├── lib/api.js         # axios client: Bearer token, wake-up retries
│   │   ├── components/        # TopBar, StoryViewer, BoostModal, ServerWakeBanner, ...
│   │   ├── pages/             # Login, Register, Feed, Events, Mechanics, Messages, Profile
│   │   └── index.css          # Bee theme, hive stripes, story rings, animations
│   ├── public/demo/           # Sample photos used by the demo content
│   ├── vercel.json
│   └── .env.example           # REACT_APP_BACKEND_URL
└── README.md
```

---

## Getting started (local dev)

You need Node.js 18+ with Yarn 1.22, Python 3.11, and MongoDB (local, or a free Atlas cluster).

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then edit MONGO_URL / JWT_SECRET
uvicorn server:app --port 8001 --reload
```

On startup the API seeds the demo account and sample content (safe to run repeatedly). Check it with `curl localhost:8001/api/health`.

**Frontend**

```bash
cd frontend
yarn install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start                         # http://localhost:3000
```

### Environment variables (backend)

| Name | Required | What it does |
|---|---|---|
| `MONGO_URL` | yes | MongoDB connection string (Atlas: `mongodb+srv://...`) |
| `DB_NAME` | yes | Database name, e.g. `drivehive` |
| `JWT_SECRET` | yes | Long random string used to sign logins |
| `CORS_ORIGINS` | yes in prod | Comma-separated frontend URLs, e.g. `https://drivehive.vercel.app` |
| `CORS_ORIGIN_REGEX` | no | Extra allowed origins; default allows `https://drivehive*.vercel.app` previews |
| `COOKIE_SECURE` | no | `true` in production (HTTPS), `false` for local http |
| `STRIPE_API_KEY` | no | `sk_test_...` enables real test-mode checkout for Boost; without it Boost is a demo |
| `STRIPE_WEBHOOK_SECRET` | no | Verifies `/api/webhook/stripe` calls |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | no | Both set: an admin account is created. No default admin ships with the app |

---

## Deploy it for free (Atlas → Render → Vercel)

This is how I run it for $0. If you fork it, the same steps work for you.

**1. Database: MongoDB Atlas (M0, free)**
1. Create a free M0 cluster.
2. *Database Access*: add a user (e.g. `drivehive`) with a generated password.
3. *Network Access*: allow `0.0.0.0/0` (Render's free tier has no fixed IP).
4. *Connect → Drivers*: copy the `mongodb+srv://...` string and put your password in it.

**2. API: Render (free web service)**
1. New → **Blueprint** → pick this repo (it reads `render.yaml`), or New → Web Service with:
   - Root Directory `backend`
   - Build Command `pip install -r requirements.txt`
   - Start Command `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Instance type **Free**, env `PYTHON_VERSION=3.11.9`
2. Env vars: `MONGO_URL` (from Atlas), `DB_NAME=drivehive`, `JWT_SECRET` (any long random string; the blueprint generates one), `CORS_ORIGINS` (your Vercel URL, add it after step 3), `COOKIE_SECURE=true`.
3. When it's live, `https://<service>.onrender.com/api/health` returns `{"ok": true, "db": true, ...}`.

**3. Frontend: Vercel (Hobby, free)**
1. Import the repo, Root Directory `frontend` (build settings come from `frontend/vercel.json`).
2. Env var `REACT_APP_BACKEND_URL` = your Render URL, e.g. `https://drivehive-api.onrender.com` (no trailing slash, no `/api`).
3. Deploy, then put the Vercel URL into Render's `CORS_ORIGINS` and redeploy the API.

---

## API overview

All endpoints are prefixed with `/api`. Login, register and demo responses include an `access_token`; send it as `Authorization: Bearer <token>`. httpOnly cookies are also set for browsers that allow them.

<details>
<summary><strong>Auth</strong></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account (`role` = `user` or `mechanic`) |
| POST | `/api/auth/login` | Log in, returns user + `access_token` (+ cookies) |
| POST | `/api/auth/demo` | One-tap login into the public demo account |
| POST | `/api/auth/logout` | Clear cookies |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/health` | Liveness + database check |

</details>

<details>
<summary><strong>Posts / Comments / Shares</strong></summary>

| Method | Path |
|---|---|
| POST  | `/api/posts` |
| GET   | `/api/posts/feed` |
| GET   | `/api/posts/user/{id}` |
| POST  | `/api/posts/{id}/like` |
| POST  | `/api/posts/{id}/share` |
| DELETE| `/api/posts/{id}` |
| GET   | `/api/posts/{id}/comments` |
| POST  | `/api/posts/{id}/comments` |

</details>

<details>
<summary><strong>Stories</strong></summary>

| Method | Path |
|---|---|
| POST | `/api/stories` (body: `{media_path, media_type}`) |
| GET  | `/api/stories` (grouped by user, with `has_unviewed`) |
| POST | `/api/stories/{id}/view` |
| POST | `/api/stories/{id}/like` |

</details>

<details>
<summary><strong>Events / Payments</strong></summary>

| Method | Path |
|---|---|
| POST   | `/api/events` |
| GET    | `/api/events` (featured first) |
| DELETE | `/api/events/{id}` |
| GET    | `/api/payments/config` (`enabled: false` = demo mode) |
| GET    | `/api/payments/packages` |
| POST   | `/api/events/{id}/boost/checkout` → Stripe URL |
| POST   | `/api/events/{id}/boost/demo` (only without a Stripe key) |
| GET    | `/api/payments/status/{session_id}` |
| POST   | `/api/webhook/stripe` |

</details>

<details>
<summary><strong>Users / Follows / Messages / Search</strong></summary>

| Method | Path |
|---|---|
| GET    | `/api/users/{id}` |
| PATCH  | `/api/users/me` |
| GET    | `/api/users/{id}/stats` |
| GET    | `/api/users/me/connections` |
| POST   | `/api/users/{id}/follow` |
| DELETE | `/api/users/{id}/follow` |
| GET    | `/api/mechanics` |
| POST   | `/api/messages` |
| GET    | `/api/messages/conversations` |
| GET    | `/api/messages/{other_user_id}` |
| GET    | `/api/notifications` |
| POST   | `/api/notifications/read` |
| GET    | `/api/search?q=...` |
| POST   | `/api/upload` (multipart, image or video) |
| GET    | `/api/files/{path}` |

</details>

---

## Testing

The pytest suite runs against a live local API with the fixed test accounts turned on:

```bash
cd backend
pip install -r requirements-dev.txt
SEED_TEST_ACCOUNTS=true ADMIN_EMAIL=admin@drivehive.com ADMIN_PASSWORD=admin123 COOKIE_SECURE=false \
  uvicorn server:app --port 8001 &
pytest tests/ -q
```

The tests cover auth, posts, comments, follows, notifications, search, events, payments / boost, stories (including video), shares, and connections. Last run: 51 passed, 2 skipped (the Stripe checkout cases, which need a test key).

---

## Color palette

| Token | Hex | Use |
|---|---|---|
| Background | `#FFFFFF` / `#FAFAFA` | Page + soft surfaces |
| Ink | `#000000` | Text, outlines, accents |
| Brand | `#FACC15` | Primary action, likes ("revs"), featured badge |
| Brand hover | `#EAB308` | Hover state |
| Border | `#E4E4E7` | Hairlines |
| Muted | `#71717A` | Secondary text |

---

## Roadmap

- [ ] Share dedupe (one share per user per post)
- [ ] Swipe gestures on the StoryViewer
- [ ] Story reply → DM owner
- [ ] RSVP + attendee list on events
- [ ] Comments count preview on post card
- [ ] "Top of the week" discovery page
- [ ] Split `server.py` into routers
- [ ] Rate limit login + share endpoints
- [ ] Push notifications (service worker)

---

## Credits

- Design system & bee-hive aesthetic built on top of [shadcn/ui](https://ui.shadcn.com) + [Tailwind](https://tailwindcss.com)
- Icons: [Phosphor Icons](https://phosphoricons.com)
- Fonts: [Clash Display](https://www.fontshare.com/fonts/clash-display) by Indian Type Foundry + [Manrope](https://manrope.co) by Mikhail Sharanda
- Demo photos from Wikimedia Commons, resized: [Honda Civic Type R](https://commons.wikimedia.org/wiki/File:Honda_Civic_Type_R_(FK8)_Washington_DC_Metro_Area,_USA.jpg) by OWS Photography (CC BY 4.0) ·
  [Subaru WRX STI](https://commons.wikimedia.org/wiki/File:Moscow,_Subaru_WRX_STI_blue,_Mar_2026_02.jpg) (CC0) ·
  [Mazda MX-5](https://commons.wikimedia.org/wiki/File:Mazda_MX-5_(NA)_114430.jpg) (CC0) ·
  [Toyota Supra](https://commons.wikimedia.org/wiki/File:Toyota_Supra_mk4.jpg) (CC0) ·
  [Nissan Skyline GT-R R34](https://commons.wikimedia.org/wiki/File:2001_Nissan_Skyline_GT-R_V-Spec_II_R34_(56664).jpg) by Calreyn88 (CC BY-SA 4.0) ·
  [Honda City Turbo II engine bay](https://commons.wikimedia.org/wiki/File:Honda_City_Turbo_II_engine_bay.jpg) by TKOIII (CC BY 4.0) ·
  [Parking deck](https://commons.wikimedia.org/wiki/File:FIRST_ONES_HERE_(Unsplash).jpg) by Martin Sanchez (CC0) ·
  [Civic Type R at Osaka Auto Messe](https://commons.wikimedia.org/wiki/File:Osaka_Auto_Messe_2018_(426)_-_Honda_CIVIC_TYPE_R_(DBA-FK8).jpg) by Tokumeigakarinoaoshima (CC BY-SA 4.0) ·
  [BMW M3 E30](https://commons.wikimedia.org/wiki/File:BMW_M3_(E30)_of_Peter_Brock_at_the_2025_Adelaide_Grand_Final.jpg) by Yu Chu Chin (CC BY-SA 4.0)
- Designed and built by me, Ry Reign

---

## License

MIT. Do whatever you want with it — just don't rip off the hive. 🐝
