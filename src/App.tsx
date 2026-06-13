import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { Navbar } from "./components/Navbar";
import { WcBackground } from "./components/WcBackground";
import { LoadingScreen } from "./components/LoadingScreen";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AdminPage from "./pages/AdminPage";
import SettingsPage from "./pages/SettingsPage";
import RulesPage from "./pages/RulesPage";
import CalendarPage from "./pages/CalendarPage";
import SimulatorPage from "./pages/SimulatorPage";
import SimulatorRegulaminPage from "./pages/SimulatorRegulaminPage";
import { ChatWidget } from "./components/ChatWidget";
import { PwaInstallCard } from "./components/PwaInstallCard";
import { ChatProvider } from "./contexts/ChatContext";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <>
        <WcBackground />
        <div className="relative flex min-h-screen items-center justify-center">
          <LoadingScreen label="Wczytywanie ligi…" />
        </div>
      </>
    );
  }

  return (
    <ChatProvider>
      <WcBackground />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6">
        <Navbar />
        <main className="flex-1 py-6">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={user ? "/dashboard" : "/leaderboard"} replace />}
            />
            <Route
              path="/login"
              element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
            />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/symulator/regulamin"
              element={
                <PrivateRoute>
                  <SimulatorRegulaminPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/symulator"
              element={
                <PrivateRoute>
                  <SimulatorPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to={user ? "/dashboard" : "/leaderboard"} replace />} />
          </Routes>
        </main>
        {user && <ChatWidget />}

        <footer className="border-t border-white/10 py-4 text-center text-sm text-white/45">
          <div className="mb-3 flex justify-center">
            <PwaInstallCard compact />
          </div>
          <p>Wielka Liga Typerów · FIFA World Cup 26</p>
          <p className="mt-1 text-xs text-white/30">WE ARE 26</p>
          <p className="mt-2 text-xs text-white/35">
            Autor: Mateusz Turowski ·{" "}
            <a
              href="https://github.com/TMateusz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--wc-gold)]/80 hover:text-[var(--wc-gold)] hover:underline"
            >
              GitHub
            </a>
            {" · Discord: "}
            <span className="text-white/50">mateusz8372</span>
          </p>
        </footer>
      </div>
    </ChatProvider>
  );
}
