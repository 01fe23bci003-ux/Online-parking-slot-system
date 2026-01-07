import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const ADMIN_CODE = "admin123"; // Simple admin code

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simple validation
    if (adminCode === ADMIN_CODE) {
      localStorage.setItem("adminToken", "admin_" + Date.now());
      navigate("/admin-dashboard");
    } else {
      setError("Invalid admin code");
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Admin Portal</h1>
        <h2>Admin Login</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label>Admin Code</label>
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="Enter admin code"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Verifying..." : "Login as Admin"}
          </button>
        </form>

        <p className="auth-footer">
          Not an admin? <a href="/">Go to User Login</a>
        </p>

        <div style={{ marginTop: "20px", fontSize: "0.85em", color: "#999", textAlign: "center" }}>
          <p>Demo Code: <code style={{ background: "#f0f0f0", padding: "2px 6px" }}>admin123</code></p>
        </div>
      </div>
    </div>
  );
}
