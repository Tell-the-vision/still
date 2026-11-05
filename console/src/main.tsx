import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { WorkspaceProvider } from "./store";
import Editor from "./pages/Editor";
import Placeholder from "./pages/Placeholder";
import Venues from "./pages/Venues";
import Workspace from "./pages/Workspace";
import Works, { PublishedRedirect } from "./pages/Works";
import Labels from "./pages/Labels";
import Account from "./pages/Account";
import Help from "./pages/Help";
import ChangePassword from "./pages/ChangePassword";
import SignIn from "./pages/SignIn";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceProvider>
      {/* Served under /console; visitor routes (/, /account, /e/...) belong to the Expo app. */}
      <BrowserRouter basename="/console">
        <Routes>
          <Route path="sign-in" element={<SignIn />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route element={<Layout />}>
            {/* The editor is the console's home: upload, edit and review the artworks' texts in one place. */}
            <Route index element={<Editor />} />
            {/* The open artwork as a resource; the same Editor stays mounted while it changes. */}
            <Route path="exhibitions/:code/works" element={<Works />} />
            <Route path="exhibitions/:code/labels" element={<Labels />} />
            <Route path="exhibitions/:code/:artwork?" element={<Editor />} />
            {/* Screens the editor replaced (preview, publishing, the guide, the old lists) and earlier addresses land in it. */}
            {["preview", "publish", "guide", "exhibitions", "overview", "materials", "materials/*"].map((path) => (
              <Route key={path} path={path} element={<Navigate to="/" replace />} />
            ))}
            <Route path="workspace" element={<Workspace />} />
            <Route path="published" element={<PublishedRedirect />} />
            <Route path="account" element={<Account />} />
            <Route path="venues" element={<Venues />} />
            <Route path="settings" element={<Navigate to="/venues" replace />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  </StrictMode>,
);
