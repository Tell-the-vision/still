import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { WorkspaceProvider } from "./store";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Overview from "./pages/Overview";
import Preview from "./pages/Preview";
import Publish from "./pages/Publish";
import Published from "./pages/Published";
import Guide from "./pages/Guide";
import Exhibitions from "./pages/Exhibitions";
import Placeholder from "./pages/Placeholder";
import Settings from "./pages/Settings";
import Workspace from "./pages/Workspace";
import Account from "./pages/Account";
import Help from "./pages/Help";
import SignIn from "./pages/SignIn";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceProvider>
      {/* Served under /console; visitor routes (/, /account, /e/...) belong to the Expo app. */}
      <BrowserRouter basename="/console">
        <Routes>
          <Route path="sign-in" element={<SignIn />} />
          {/* Outside Layout so /console redirects right away, even while the workspace is loading or failed. */}
          <Route index element={<Navigate to="/overview" replace />} />
          <Route element={<Layout />}>
            <Route path="overview" element={<Overview />} />
            <Route path="materials" element={<Upload />} />
            <Route path="materials/review" element={<Review />} />
            <Route path="materials/preview" element={<Preview />} />
            <Route path="materials/publish" element={<Publish />} />
            <Route path="materials/published" element={<Published />} />
            <Route path="guide" element={<Guide />} />
            <Route path="exhibitions" element={<Exhibitions />} />
            <Route path="workspace" element={<Workspace />} />
            <Route path="account" element={<Account />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  </StrictMode>,
);
