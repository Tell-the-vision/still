import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { AuthProvider } from "./auth";
import SignIn from "./pages/SignIn";
import ChangePassword from "./pages/ChangePassword";
import Institutions from "./pages/Institutions";
import Operators from "./pages/Operators";
import Placeholder from "./pages/Placeholder";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Served under /admin. STILL staff only; museum staff use /console, visitors use the Expo app. */}
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="sign-in" element={<SignIn />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/institutions" replace />} />
            {/* One route each, so moving between records keeps the page (and its list) mounted. */}
            <Route path="institutions/:id?" element={<Institutions />} />
            <Route path="operators/:id?" element={<Operators />} />
            <Route path="team" element={<Navigate to="/operators" replace />} />
            <Route path="users" element={<Navigate to="/operators" replace />} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
