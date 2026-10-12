import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { Plus } from "@phosphor-icons/react";
import "@/App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { TopBar, MobileBottomNav } from "./components/TopBar";
import { CreatePostModal } from "./components/CreatePostModal";
import { CreateEventModal } from "./components/CreateEventModal";
import { ServerWakeBanner } from "./components/ServerWakeBanner";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FeedPage from "./pages/FeedPage";
import EventsPage from "./pages/EventsPage";
import MechanicsPage from "./pages/MechanicsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-display text-2xl font-bold animate-pulse">Loading the hive…</div>
    </div>
  );
}

function ProtectedLayout() {
  const { user } = useAuth();
  const loc = useLocation();
  const [postOpen, setPostOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (user === null) return <Loading />;
  if (user === false) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const onCreate = () => {
    if (loc.pathname.startsWith("/events")) setEventOpen(true);
    else setPostOpen(true);
  };
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-white">
      <TopBar onCreate={onCreate} />
      <main key={refreshKey}>
        <Outlet
          context={{
            openCreate: () => setPostOpen(true),
            openStory: () => setStoryOpen(true),
            openEvent: () => setEventOpen(true),
          }}
        />
      </main>

      {/* FAB */}
      <button
        onClick={onCreate}
        data-testid="fab-create-btn"
        className="hidden sm:flex md:hidden fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-[#FACC15] border-2 border-black items-center justify-center shadow-xl hive-bob"
      >
        <Plus size={24} weight="bold" />
      </button>

      <MobileBottomNav onCreate={onCreate} />

      <CreatePostModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={refresh}
        mode="post"
      />
      <CreatePostModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        onCreated={refresh}
        mode="story"
      />
      <CreateEventModal
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        onCreated={refresh}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

// outlet wrappers to forward context
import { useOutletContext } from "react-router-dom";
function FeedRoute() {
  const ctx = useOutletContext();
  return <FeedPage openCreate={ctx.openCreate} openStory={ctx.openStory} />;
}
function EventsRoute() {
  const ctx = useOutletContext();
  return <EventsPage openEvent={ctx.openEvent} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ServerWakeBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<FeedRoute />} />
            <Route path="/events" element={<EventsRoute />} />
            <Route path="/mechanics" element={<MechanicsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:mechanicId" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
