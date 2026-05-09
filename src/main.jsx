import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./styles.css";
import { AppProvider } from "./context/AppContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import Layout from "./components/layout/Layout.jsx";
import Login from "./components/screens/Login.jsx";
import Dashboard from "./components/screens/Dashboard.jsx";
import AddClient from "./components/screens/AddClient.jsx";
import ClientList from "./components/screens/ClientList.jsx";
import BulkUpload from "./components/screens/BulkUpload.jsx";
import AddTask from "./components/screens/AddTask.jsx";
import TaskList from "./components/screens/TaskList.jsx";
import FtaTracker from "./components/screens/FtaTracker.jsx";
import Categories from "./components/screens/Categories.jsx";
import Users from "./components/screens/Users.jsx";
import ClientGroups from "./components/screens/ClientGroups.jsx";
import Reports from "./components/screens/Reports.jsx";

// The app keeps routing, auth, and shared data providers at the root so screens stay focused
// on UI and API interactions instead of repeating bootstrap logic.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients/add" element={<AddClient />} />
              <Route path="/clients/list" element={<ClientList />} />
              <Route path="/clients/bulk-upload" element={<BulkUpload />} />
              <Route path="/tasks/add" element={<AddTask />} />
              <Route path="/tasks/list" element={<TaskList />} />
              <Route path="/tasks/fta-tracker" element={<FtaTracker />} />
              <Route path="/tasks/categories" element={<Categories />} />
              <Route path="/settings/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
              <Route path="/settings/groups" element={<ProtectedRoute roles={["admin", "manager"]}><ClientGroups /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute roles={["admin", "manager"]}><Reports /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  </React.StrictMode>
);
