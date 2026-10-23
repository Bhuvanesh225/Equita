/**
 * Routes and providers.
 *
 * Every signed-in route sits behind one guard, and every screen is fetched on
 * demand so the first paint is the marketing page or the sign-in form rather
 * than the whole application.
 */
import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation, useParams } from "react-router-dom";

import { SessionProvider, useSession } from "./lib/session";
import { LiveProvider, ToastProvider } from "./lib/live";
import { AppShell, UiProvider } from "./shell/AppShell";
import { CommandPalette } from "./shell/CommandPalette";
import { Copilot } from "./shell/Copilot";
import { Spinner } from "./components/ui";

const Landing = lazy(() => import("./routes/Landing"));
const Login = lazy(() => import("./routes/Login"));
const Signup = lazy(() => import("./routes/Signup"));
const Join = lazy(() => import("./routes/Join"));
const Dashboard = lazy(() => import("./routes/Dashboard"));
const Projects = lazy(() => import("./routes/Projects"));
const NewProject = lazy(() => import("./routes/NewProject"));
const ProjectWorkspace = lazy(() => import("./routes/ProjectWorkspace"));
const Classrooms = lazy(() => import("./routes/Classrooms"));
const ClassroomConsole = lazy(() => import("./routes/ClassroomConsole"));
const GroupBuilder = lazy(() => import("./routes/GroupBuilder"));
const StudentRecord = lazy(() => import("./routes/StudentRecord"));
const Insights = lazy(() => import("./routes/Insights"));
const People = lazy(() => import("./routes/People"));
const Profile = lazy(() => import("./routes/Profile"));
const Notifications = lazy(() => import("./routes/Notifications"));
const Settings = lazy(() => import("./routes/Settings"));
const NotFound = lazy(() => import("./routes/NotFound"));

function Waiting({ label = "Loading" }: { label?: string }) {
  return (
    <div className="shell" role="status" aria-live="polite" aria-busy="true" style={{ paddingBlock: "4rem", display: "flex", justifyContent: "center" }}>
      <Spinner label={label} />
    </div>
  );
}

const page = (node: ReactNode) => <Suspense fallback={<Waiting />}>{node}</Suspense>;

/** Everything behind the sign-in wall, including the shell that holds it. */
function Guarded() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) return <Waiting label="Opening your work" />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <AppShell />;
}

/**
 * The two things that can appear over any screen. They are rendered from inside
 * the router's own tree — a route element — because both of them navigate, and
 * a component that navigates has to sit under the router that owns the history.
 */
function Overlays() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <>
      <CommandPalette />
      <Copilot />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: (
      <>
        <Outlet />
        <Overlays />
      </>
    ),
    children: [
      { path: "/", element: page(<Landing />) },
      { path: "/login", element: page(<Login />) },
      { path: "/signup", element: page(<Signup />) },
      { path: "/join", element: page(<Join />) },
      {
        element: <Guarded />,
        children: [
          { path: "/today", element: page(<Dashboard />) },
          { path: "/projects", element: page(<Projects />) },
          { path: "/projects/new", element: page(<NewProject />) },
          { path: "/projects/:projectId", element: page(<ProjectWorkspace />) },
          /*
           * The engines link to a task on the board as `/projects/:id/board?task=…`,
           * which is not the shape this workspace reads (`?tab=board&task=…`). Rather
           * than rewrite five server files and migrate every notification row already
           * stored with the old link, the old shape is served here. The same element
           * handles it — it reads `:projectId` and ignores the extra segment.
           */
          { path: "/projects/:projectId/board", element: page(<ProjectWorkspace />) },
          { path: "/classrooms", element: page(<Classrooms />) },
          { path: "/classrooms/:classroomId", element: page(<ClassroomConsole />) },
          { path: "/classrooms/:classroomId/groups", element: page(<GroupBuilder />) },
          /* A class group is a project in this data model, so "open the group" is the board. */
          { path: "/classrooms/:classroomId/groups/:projectId", element: <GroupRedirect /> },
          { path: "/classrooms/:classroomId/students/:studentId", element: page(<StudentRecord />) },
          { path: "/insights", element: page(<Insights />) },
          { path: "/people", element: page(<People />) },
          /* `/api/insights/search` and two built screens already link to a person this way. */
          { path: "/people/:personId", element: page(<People />) },
          { path: "/profile", element: page(<Profile />) },
          { path: "/notifications", element: page(<Notifications />) },
          { path: "/settings", element: page(<Settings />) },
          { path: "*", element: page(<NotFound />) },
        ],
      },
    ],
  },
]);

/** The engine's `/classrooms/:id/groups/:projectId` resolves to that group's board. */
function GroupRedirect() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}`} replace />;
}

export function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Bridge />
      </SessionProvider>
    </ToastProvider>
  );
}

/** Reads the session so the live channel only runs for a signed-in person. */
function Bridge() {
  const { user } = useSession();
  return (
    <LiveProvider enabled={!!user}>
      <UiProvider>
        <div className="demo-notice" role="note">Demo data · seeded examples, not real users</div>
        <RouterProvider router={router} />
      </UiProvider>
    </LiveProvider>
  );
}
