import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://localhost:5000/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        }
        return;
      }

      const userData = await response.json();
      setUser(userData);
      setName(userData.name);
      setRegistrationNumber(userData.registrationNumber || "");
      setPhoneNumber(userData.phoneNumber || "");
      setLoading(false);
    } catch (err) {
      setError("Failed to load profile");
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          registrationNumber,
          phoneNumber,
        }),
      });

      if (!response.ok) {
        setError("Failed to update profile");
        return;
      }

      const data = await response.json();
      setUser(data.user);
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loading) return <div className="container"><p>Loading profile...</p></div>;

  return (
    <div className="profile-container">
      <div className="profile-box">
        <div className="profile-header-top">
          <h2>My Profile</h2>
          <button onClick={() => navigate("/dashboard")} className="btn-back" title="Back to Dashboard">
            ← Back
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {user && (
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Email (Cannot be changed)</label>
              <input type="email" value={user.email} disabled />
            </div>

            <div className="form-group">
              <label>Vehicle Registration</label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="DL 01 AB 1234"
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <button type="submit" className="btn-primary">
              Update Profile
            </button>
          </form>
        )}

        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>
    </div>
  );
}
