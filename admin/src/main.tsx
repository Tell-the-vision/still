import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { AuthProvider } from "./auth";
import SignIn from "./pages/SignIn";
import ChangePassword from "./pages/ChangePassword";
import Institutions from "./pages/Institutions";
import Placeholder from "./pages/Placeholder";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Served under /admin. STILL staff only; museum staff use /institutions, visitors use the Expo app. */}
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="sign-in" element={<SignIn />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/institutions" replace />} />
            <Route path="institutions" element={<Institutions />} />
            <Route path="overview" element={<Placeholder title="Overview" />} />
            <Route path="users" element={<Placeholder title="Users & access" />} />
            <Route path="audit" element={<Placeholder title="Audit log" />} />
            <Route path="settings" element={<Placeholder title="Platform settings" />} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
