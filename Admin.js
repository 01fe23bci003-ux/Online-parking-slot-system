import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchBookings();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/history");
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setLoading(false);
    }
  };

  const resetData = async () => {
    if (!window.confirm("Are you sure? This will delete all data!")) return;

    try {
      await fetch("http://localhost:5000/api/admin/reset", { method: "POST" });
      alert("Data reset successfully!");
      fetchStats();
      fetchBookings();
    } catch (error) {
      alert("Reset failed");
    }
  };

  if (loading) return <div className="loading-container">⏳ Loading...</div>;

  return (
    <div className="app-container">
      <div className="header">
        <h1>📊 Admin Dashboard</h1>
        <button onClick={() => navigate("/")} className="header-btn">← Back</button>
      </div>

      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <p className="stat-label">Total Users</p>
            <p className="stat-value">{stats.totalUsers}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Bookings</p>
            <p className="stat-value">{stats.totalBookings}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Revenue</p>
            <p className="stat-value">₹{stats.totalRevenue}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Occupancy</p>
            <p className="stat-value">{stats.occupancyRate}%</p>
          </div>
        </div>
      )}

      <div className="admin-section">
        <h2>📋 Booking History</h2>
        <button onClick={resetData} className="btn-reset">🔄 Reset All Data</button>
        
        <div className="table-container">
          <div className="table-header">
            <div className="table-cell">Slot</div>
            <div className="table-cell">Vehicle</div>
            <div className="table-cell">Hours</div>
            <div className="table-cell">Amount</div>
            <div className="table-cell">Status</div>
            <div className="table-cell">Time</div>
          </div>

          {bookings.map((booking, idx) => (
            <div key={idx} className="table-row">
              <div className="table-cell">#{booking.slot}</div>
              <div className="table-cell">{booking.registrationNumber}</div>
              <div className="table-cell">{booking.hours}h</div>
              <div className="table-cell">₹{booking.amount}</div>
              <div className="table-cell">{booking.paymentStatus}</div>
              <div className="table-cell">{booking.bookedTime}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
