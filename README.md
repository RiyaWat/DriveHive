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

DriveHive is a full-stack social network built for car people — a black / yellow / white "bee hive" aesthetic layered on top of an Instagram-style feed, with features tailored to the automotive community:

- 🏁 **Live feed** of builds and meet recaps from other riders
- 📸 **Stories** (photos + videos) that auto-expire in 24 hours, with an in-app Instagram-style viewer
- 🗓️ **Events** — user-hosted car meets with a paid **⚡ Boost** option (Stripe-powered)
- 🔧 **Mechanic DMs** — real registered mechanics you can message for quick advice
- 👥 **Crew DMs** — chat with any rider you follow or who follows you
- 🔔 Notifications, 🔍 search, ❤️ likes, 💬 comments, ↗️ share-to-crew, 👤 follow / unfollow

---

## Demo accounts

After seeding, these accounts work out of the box:

| Role       | Email                    | Password   |
|------------|--------------------------|------------|
| Admin      | `admin@drivehive.com`    | `admin123` |
| Enthusiast | `rider@drivehive.com`    | `rider123` |
| Mechanic   | `mike@drivehive.com`     | `mike123`  |
| Mechanic   | `sara@drivehive.com`     | `sara123`  |
| Mechanic   | `leo@drivehive.com`      | `leo123`   |

> ⚠️ **For demo purposes only.** Change these before shipping to production.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS, shadcn/ui, [@phosphor-icons/react](https://phosphoricons.com), Sonner toasts |
| Backend  | FastAPI (`/api` prefix), Motor (async MongoDB), bcrypt, PyJWT |
| Database | MongoDB (`drivehive_db`) |
| Storage  | MongoDB GridFS (post photos, story photos/videos, avatars live in the same database) |
| Payments | Stripe Checkout (official `stripe` Python SDK) for Featured Meet boosts |
| Auth     | JWT access + refresh tokens in httpOnly cookies (with `SameSite=None; Secure`) |
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
/app
├── backend/
│   ├── server.py              # All FastAPI routes (auth, posts, stories, events, messages, payments, storage, search)
│   ├── requirements.txt
│   ├── tests/                 # pytest suites
│   └── .env                   # Not committed. See .env.example below.
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── context/AuthContext.jsx
│   │   ├── lib/api.js
│   │   ├── components/        # TopBar, Avatar, StoryViewer, ShareSheet, CreatePostModal, CreateEventModal, BoostModal, CommentsDrawer, NotificationsBell, SearchBox, HiveLogo
│   │   ├── pages/             # LoginPage, RegisterPage, FeedPage, EventsPage, MechanicsPage, MessagesPage, ProfilePage
│   │   └── index.css          # Bee theme, hive stripes, story rings, animations
│   ├── public/index.html
│   ├── package.json
│   └── .env                   # REACT_APP_BACKEND_URL
├── memory/
│   ├── PRD.md                 # Product spec & backlog
│   └── test_credentials.md    # Seeded test accounts
└── README.md
```

---

## Getting started (local dev)

### Prerequisites

- **Node.js** 18+ and **Yarn** 1.22+
- **Python** 3.10+
- **MongoDB** 5+ running locally (or a connection string)
- Optional: a [Stripe](https://stripe.com) test secret key if you want to try the Featured Boost flow

### 1. Clone

```bash
git clone https://github.com/<your-username>/drivehive.git
cd drivehive
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create backend/.env (see .env.example below), then:
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

`backend/.env.example`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="drivehive_db"
CORS_ORIGINS="*"
JWT_SECRET="generate-a-64-char-hex-string"
ADMIN_EMAIL="admin@drivehive.com"
ADMIN_PASSWORD="admin123"
APP_NAME="drivehive"
FRONTEND_URL="http://localhost:3000"

# Optional integrations
STRIPE_API_KEY=""          # required for Featured Boost payments
STRIPE_WEBHOOK_SECRET=""   # optional: verifies /api/webhook/stripe calls
```

> Generate a JWT secret: `python -c "import secrets; print(secrets.token_hex(32))"`

### 3. Frontend

```bash
cd ../frontend
yarn install

# Create frontend/.env:
# REACT_APP_BACKEND_URL=http://localhost:8001

yarn start
```

The app will open at http://localhost:3000.

On first backend start, the admin user and mechanic seeds are created automatically.

---

## Deploying for free

- **Frontend (Vercel):** import the repo, Root Directory `frontend`, build `CI=false yarn build`, output `build`
  (both already in `frontend/vercel.json`). Set `REACT_APP_BACKEND_URL` to your backend's URL.
- **Backend:** FastAPI needs a long-running Python host (Render, Railway, Fly.io free tiers) — not Vercel.
  Set the env vars above (`MONGO_URL`, `DB_NAME`, `JWT_SECRET` are required). The API already accepts
  cross-site requests with cookies (`SameSite=None; Secure`), so it must be served over HTTPS.
- **Database:** a free MongoDB Atlas M0 cluster; put its connection string in `MONGO_URL`.

---

## API overview

All endpoints are prefixed with `/api`. Authentication uses httpOnly cookies (`access_token`, `refresh_token`). Send with `credentials: "include"` (fetch) or `withCredentials: true` (axios). A `Bearer` header is also accepted.

<details>
<summary><strong>Auth</strong></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account (`role` = `user` or `mechanic`) |
| POST | `/api/auth/login` | Log in, returns user + sets cookies |
| POST | `/api/auth/logout` | Clear cookies |
| GET  | `/api/auth/me` | Current user |

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
| GET    | `/api/payments/packages` |
| POST   | `/api/events/{id}/boost/checkout` → Stripe URL |
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

```bash
cd backend
pytest tests/ -v
```

The suite covers auth, posts, comments, follows, notifications, search, events, payments / boost, stories (including video), shares, and connections. At last run: **37 / 37 green**.

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
- Built by Ry Reign

---

## License

MIT. Do whatever you want with it — just don't rip off the hive. 🐝
