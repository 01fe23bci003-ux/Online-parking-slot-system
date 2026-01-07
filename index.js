import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./Login";
import Register from "./Register";
import Profile from "./Profile";
import Admin from "./Admin";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import Payment from "./Payment";
import LocationServices from "./LocationServices";
import "./App.css";

// Protected Route Component
function ProtectedRoute({ element, isAdmin = false }) {
  const token = isAdmin ? localStorage.getItem("adminToken") : localStorage.getItem("token");
  const redirectPath = isAdmin ? "/admin-login" : "/login";
  return token ? element : <Navigate to={redirectPath} replace />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Routes>
      {/* Default route redirects to login if not authenticated */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Authentication Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected User Routes */}
      <Route path="/dashboard" element={<ProtectedRoute element={<App />} />} />
      <Route path="/profile" element={<ProtectedRoute element={<Profile />} />} />
      <Route path="/payment" element={<ProtectedRoute element={<Payment />} />} />
      <Route path="/location" element={<ProtectedRoute element={<LocationServices />} />} />
      
      {/* Admin Routes */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin-dashboard" element={<ProtectedRoute element={<AdminDashboard />} isAdmin={true} />} />
      <Route path="/admin" element={<ProtectedRoute element={<Admin />} isAdmin={true} />} />
    </Routes>
  </BrowserRouter>
);
