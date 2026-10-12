"""Idempotent demo content so a fresh deployment isn't empty.

Runs on every startup (Render's free tier restarts the server after it sleeps), and:
  * creates the public demo account + a handful of riders/mechanics if missing,
  * puts back any seeded post / meet / story / message that was deleted,
  * keeps seeded meets in the future and seeded stories inside their 24h window,
  * resets the demo account's profile, so visitors can't permanently deface it.

Images are small JPEGs served by the frontend itself (frontend/public/demo/*.jpg),
so seeding needs no file uploads. Photo credits are in the README.
"""
import secrets
from datetime import datetime, timezone, timedelta

DEMO_EMAIL = "demo@drivehive.app"
DEMO_PASSWORD = "drivehive-demo"  # public on purpose: it's a demo account

DEMO_PROFILE = {
    "name": "Alex Rider",
    "bio": "JDM enthusiast. Daily a Championship White Civic Type R. (This is the public demo account.)",
    "specialty": "",
    "avatar_url": "",
}

# key, email, name, role, specialty, bio
PEOPLE = [
    ("mike", "mike@drivehive.app", "Mike Torres", "mechanic", "Engine & Drivetrain",
     "ASE-certified. 12 years on Hondas, Subarus and Mazdas."),
    ("sara", "sara@drivehive.app", "Sara Lin", "mechanic", "Suspension & Brakes",
     "Track-day prep specialist. Coilovers, big brake kits, alignments."),
    ("leo", "leo@drivehive.app", "Leo Park", "mechanic", "Electrical & Diagnostics",
     "EV conversions and ECU tunes. OBD2 wizard."),
    ("jordan", "jordan@drivehive.app", "Jordan Blake", "user", "",
     "WRX STI, 6-speed, World Rally Blue. Rallycross on weekends."),
    ("priya", "priya@drivehive.app", "Priya Shah", "user", "",
     "NA Miata, 1.6, hardtop season all year. Autocross addict."),
    ("marcus", "marcus@drivehive.app", "Marcus Reed", "user", "",
     "MK4 Supra. Single turbo, still daily-able. Mostly."),
    ("kenji", "kenji@drivehive.app", "Kenji Mori", "user", "",
     "R34 GT-R V-Spec II. 25-year rule finally paid off."),
]

# id, author key, image, caption, hours ago, liked by, comments [(key, text)]
POSTS = [
    ("seed-post-r34", "kenji", "/demo/r34.jpg",
     "She finally cleared customs. 2001 V-Spec II, Bayside Blue, 41k km. Three years of waiting for this one.",
     2, ["demo", "marcus", "priya", "jordan"],
     [("marcus", "Unreal. Bring it to Saturday's meet?"), ("kenji", "Already planning on it 🙌")]),
    ("seed-post-civic", "demo", "/demo/civic.jpg",
     "Fresh detail on the FK8 before the weekend. Ceramic coat is holding up great after 6 months.",
     5, ["jordan", "kenji"],
     [("jordan", "That white is so clean"), ("mike", "Oil change is due at 5k on these turbos, don't skip it!")]),
    ("seed-post-wrx", "jordan", "/demo/wrx.jpg",
     "Snow tires off, summer tires on. Who's coming to the rallycross practice day?",
     9, ["demo", "sara"],
     [("sara", "Check your pads after the winter, salt eats rotors")]),
    ("seed-post-engine", "leo", "/demo/engine.jpg",
     "Clean engine bay of the week: a Honda City Turbo II. Tiny car, tiny turbo, huge grin. Send me yours.",
     20, ["demo", "priya", "mike"], []),
    ("seed-post-miata", "priya", "/demo/miata.jpg",
     "Miata is always the answer. New coilovers are in, corner-balanced by Sara. Feels like a go-kart.",
     30, ["demo", "sara", "kenji"],
     [("sara", "Glad it's dialed in! Come back after a few track days and we'll re-check it")]),
    ("seed-post-supra", "marcus", "/demo/supra.jpg",
     "2JZ doing 2JZ things. Dyno day results: 612 whp on pump gas.",
     44, ["jordan", "kenji"],
     [("demo", "612 on pump?! What turbo?"), ("marcus", "Precision 6466. Message me, happy to share the build list")]),
]

# id, host key, title, location, days from now, image, description, featured
EVENTS = [
    ("seed-event-coffee", "demo", "Sunday Cars & Coffee", "Riverside Plaza parking deck, Level 3", 3,
     "/demo/meet.jpg",
     "Casual morning meet. Grab a coffee, park up, talk shop. All makes welcome. No burnouts, no revving.", False),
    ("seed-event-jdm", "kenji", "JDM Night Meet", "Harbor Point Lot B", 6, "/demo/osaka.jpg",
     "Night meet for Japanese cars of every era. Food trucks from 7pm. Bring a camera.", True),
    ("seed-event-classics", "mike", "Euro Classics Show & Shine", "Downtown Convention Center", 13, "/demo/m3.jpg",
     "E30s, 911s, Golf GTIs and other European classics. Free tech inspection booth by DriveHive mechanics.", False),
]

# id, author key, image, minutes ago
STORIES = [
    ("seed-story-kenji", "kenji", "/demo/r34.jpg", 40),
    ("seed-story-priya", "priya", "/demo/miata.jpg", 95),
    ("seed-story-marcus", "marcus", "/demo/supra.jpg", 180),
]

# id, from key, to key, text, minutes ago
MESSAGES = [
    ("seed-msg-1", "demo", "mike", "Hey Mike, getting a slight shudder in 3rd gear on my Civic. Clutch or something else?", 300),
    ("seed-msg-2", "mike", "demo", "Does it happen under load, or when you let off? Shudder under load is usually clutch or motor mounts.", 290),
    ("seed-msg-3", "demo", "mike", "Under load, mostly uphill.", 285),
    ("seed-msg-4", "mike", "demo", "Check the rear motor mount first, it's a common one on the FK8 and a lot cheaper than a clutch. Happy to look at it Saturday.", 270),
    ("seed-msg-5", "kenji", "demo", "Saw your Civic post, you coming to the JDM night meet?", 60),
]

FOLLOWS = [
    ("demo", "kenji"), ("demo", "jordan"), ("demo", "mike"), ("demo", "priya"),
    ("kenji", "demo"), ("jordan", "demo"), ("marcus", "demo"), ("marcus", "kenji"), ("priya", "sara"),
]


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def seed_demo_data(db, hash_password) -> None:
    now = datetime.now(timezone.utc)
    ids = {}

    # --- users -------------------------------------------------------------
    demo = await db.users.find_one({"email": DEMO_EMAIL})
    if not demo:
        demo = {
            "id": "seed-user-demo", "email": DEMO_EMAIL, "password_hash": hash_password(DEMO_PASSWORD),
            "role": "user", "created_at": _iso(now - timedelta(days=30)), **DEMO_PROFILE,
        }
        await db.users.insert_one(demo)
    else:
        # Keep the public demo account presentable: reset its profile on every start.
        await db.users.update_one({"email": DEMO_EMAIL}, {"$set": DEMO_PROFILE})
    ids["demo"] = demo["id"]

    for key, email, name, role, specialty, bio in PEOPLE:
        u = await db.users.find_one({"email": email}, {"id": 1})
        if not u:
            u = {
                "id": f"seed-user-{key}", "email": email,
                # Random password: these are display accounts, nobody logs in as them.
                "password_hash": hash_password(secrets.token_urlsafe(24)),
                "name": name, "role": role, "bio": bio, "specialty": specialty, "avatar_url": "",
                "created_at": _iso(now - timedelta(days=60)),
            }
            await db.users.insert_one(u)
        ids[key] = u["id"]

    # --- follows -----------------------------------------------------------
    for a, b in FOLLOWS:
        await db.follows.update_one(
            {"follower_id": ids[a], "following_id": ids[b]},
            {"$setOnInsert": {"id": f"seed-follow-{a}-{b}", "created_at": _iso(now - timedelta(days=20))}},
            upsert=True,
        )

    # --- posts + comments --------------------------------------------------
    for pid, author, img, caption, hours, liked_by, comments in POSTS:
        created = now - timedelta(hours=hours)
        if not await db.posts.find_one({"id": pid}, {"_id": 1}):
            await db.posts.insert_one({
                "id": pid, "user_id": ids[author], "caption": caption,
                "image_path": img, "media_path": img, "media_type": "image",
                "likes": [ids[k] for k in liked_by], "shares": 0, "created_at": _iso(created),
            })
        for i, (ck, text) in enumerate(comments):
            await db.comments.update_one(
                {"id": f"{pid}-c{i}"},
                {"$setOnInsert": {"post_id": pid, "user_id": ids[ck], "text": text,
                                  "created_at": _iso(created + timedelta(minutes=20 * (i + 1)))}},
                upsert=True,
            )

    # --- events (always in the future) ---------------------------------------
    for eid, host, title, loc, days, img, desc, featured in EVENTS:
        starts = (now + timedelta(days=days)).replace(hour=14, minute=0, second=0, microsecond=0)
        ev = await db.events.find_one({"id": eid})
        if not ev:
            await db.events.insert_one({
                "id": eid, "user_id": ids[host], "title": title, "description": desc, "location": loc,
                "starts_at": _iso(starts), "image_path": img, "created_at": _iso(now - timedelta(days=2)),
            })
        elif (ev.get("starts_at") or "") < _iso(now):
            await db.events.update_one({"id": eid}, {"$set": {"starts_at": _iso(starts)}})
        if featured:
            ev = await db.events.find_one({"id": eid})
            if (ev.get("featured_until") or "") < _iso(now + timedelta(days=1)):
                await db.events.update_one({"id": eid}, {"$set": {
                    "featured_until": _iso(now + timedelta(days=7)), "featured_by": ids[host]}})

    # --- stories (kept inside their 24h window) ------------------------------
    for sid, author, img, minutes in STORIES:
        st = await db.stories.find_one({"id": sid})
        created = now - timedelta(minutes=minutes)
        if not st or (st.get("expires_at") or "") < _iso(now + timedelta(hours=2)):
            await db.stories.update_one({"id": sid}, {"$set": {
                "user_id": ids[author], "media_path": img, "media_type": "image",
                "likes": [], "viewed_by": [],
                "created_at": _iso(created), "expires_at": _iso(created + timedelta(hours=24)),
            }}, upsert=True)

    # --- a DM thread with a mechanic --------------------------------------
    for mid, a, b, text, minutes in MESSAGES:
        x, y = ids[a], ids[b]
        await db.messages.update_one({"id": mid}, {"$setOnInsert": {
            "conversation_id": ":".join(sorted([x, y])), "from_user_id": x, "to_user_id": y,
            "text": text, "created_at": _iso(now - timedelta(minutes=minutes)),
        }}, upsert=True)


# Fixed-password accounts used by the pytest suite (backend/tests). Only created when
# SEED_TEST_ACCOUNTS=true, so a public deployment never ships known passwords for them.
TEST_ACCOUNTS = [
    ("rider@drivehive.com", "rider123", "Alex Rider", "user", "", "JDM enthusiast. Daily a Civic Type R."),
    ("mike@drivehive.com", "mike123", "Mike Torres", "mechanic", "Engine & Drivetrain", "ASE-certified."),
    ("sara@drivehive.com", "sara123", "Sara Lin", "mechanic", "Suspension & Brakes", "Track-day prep."),
    ("leo@drivehive.com", "leo123", "Leo Park", "mechanic", "Electrical & Diagnostics", "ECU tunes."),
]


async def seed_test_accounts(db, hash_password) -> None:
    import uuid
    now = datetime.now(timezone.utc)
    for email, pw, name, role, specialty, bio in TEST_ACCOUNTS:
        if not await db.users.find_one({"email": email}, {"_id": 1}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(pw),
                "name": name, "role": role, "bio": bio, "specialty": specialty, "avatar_url": "",
                "created_at": _iso(now),
            })
