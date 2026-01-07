import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [pendingRefunds, setPendingRefunds] = useState([]);

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      navigate("/admin-login");
      return;
    }

    fetchAdminData();
    
    // Set up auto-refresh every 3 seconds
    const interval = setInterval(() => {
      fetchAdminData();
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate]);

  const fetchAdminData = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setAllBookings(data.bookings || []);
        
        // Remove duplicates in users by email
        const uniqueUsers = [];
        const userEmails = new Set();
        (data.users || []).forEach(user => {
          if (!userEmails.has(user.email)) {
            uniqueUsers.push(user);
            userEmails.add(user.email);
          }
        });
        setAllUsers(uniqueUsers);
        
        // Get cancelled bookings from all bookings and set them as pending refunds
        let cancelledBookings = [];
        if (data.bookings && data.bookings.length > 0) {
          cancelledBookings = data.bookings
            .filter(b => b.status === 'cancelled')
            .map(b => ({
              id: b.id,
              userName: b.userName,
              userEmail: b.userEmail,
              registrationNumber: b.registrationNumber || "N/A",
              slotNumber: b.slotNumber,
              duration: b.duration,
              amount: b.amount || 0,
              status: 'pending', // Initially pending for admin approval
              cancelledAt: b.cancelledAt || new Date()
            }));
        }
        setPendingRefunds(cancelledBookings);
      }
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    }
    setLoading(false);
  };

  const handleReleaseSlot = async (bookingId, slotId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/release-slot/${slotId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
          },
        }
      );

      if (response.ok) {
        fetchAdminData();
        alert("✅ Slot released successfully");
      }
    } catch (error) {
      console.error("Error releasing slot:", error);
      alert("❌ Failed to release slot");
    }
  };

  const handleApproveRefund = async (refundId, amount, userName) => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/approve-refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
        },
        body: JSON.stringify({
          refundId,
          amount,
          userName
        })
      });

      if (response.ok) {
        alert(`✅ Refund of ₹${amount} approved for ${userName}`);
        setPendingRefunds(prev => prev.filter(r => r.id !== refundId));
        fetchAdminData();
      }
    } catch (error) {
      console.error("Error approving refund:", error);
      alert("❌ Failed to approve refund");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin-login");
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  if (loading) {
    return <div className="admin-container"><p>Loading admin data...</p></div>;
  }

  return (
    <div className="admin-container">
      {/* Admin Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <h1>🅿️ Admin Dashboard</h1>
          <p>Smart Parking System Management</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          🚪 Logout
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="admin-nav">
        <button
          className={`nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        <button
          className={`nav-tab ${activeTab === "bookings" ? "active" : ""}`}
          onClick={() => setActiveTab("bookings")}
        >
          📅 All Bookings
        </button>
        <button
          className={`nav-tab ${activeTab === "refunds" ? "active" : ""}`}
          onClick={() => setActiveTab("refunds")}
        >
          💰 Refunds ({pendingRefunds.filter(r => r.status === 'pending').length})
        </button>
        <button
          className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👥 Users
        </button>
        <button
          className={`nav-tab ${activeTab === "slots" ? "active" : ""}`}
          onClick={() => setActiveTab("slots")}
        >
          🅿️ Slots
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && stats && (
        <div className="admin-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <p className="stat-number">{stats.totalUsers}</p>
              <small>Registered users</small>
            </div>
            <div className="stat-card">
              <h3>Active Bookings</h3>
              <p className="stat-number">{stats.activeBookings}</p>
              <small>Currently occupied</small>
            </div>
            <div className="stat-card success">
              <h3>Available Slots</h3>
              <p className="stat-number">{stats.availableSlots}</p>
              <small>Ready to book</small>
            </div>
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p className="stat-number">₹{stats.totalRevenue || 0}</p>
              <small>All payments</small>
            </div>
            <div className="stat-card">
              <h3>Occupancy Rate</h3>
              <p className="stat-number">{stats.occupancyRate || 0}%</p>
              <small>Current usage</small>
            </div>
            <div className="stat-card">
              <h3>Total Bookings</h3>
              <p className="stat-number">{stats.totalBookings}</p>
              <small>All time</small>
            </div>
          </div>

          <div className="admin-section">
            <h2>System Status</h2>
            <div className="status-info">
              <p>Database: Connected</p>
              <p>API: Operational</p>
              <p>Location Services: Active</p>
              <p>Payment Gateway: Ready</p>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        <div className="admin-section">
          <div className="bookings-header">
            <h2>📋 All Bookings</h2>
            <button className="btn-refresh" onClick={fetchAdminData}>
              🔄 Refresh Now
            </button>
          </div>

          <h3 style={{ marginTop: "30px", marginBottom: "15px", color: "#667eea" }}>✅ Active Bookings</h3>
          <div className="bookings-list">
            {allBookings && allBookings.filter(b => b.status === "active").length > 0 ? (
              allBookings.filter(b => b.status === "active").map((booking, idx) => (
                <div key={idx} className="booking-item">
                  <div className="booking-info">
                    <p><strong>👤 User Name:</strong> {booking.userName}</p>
                    <p><strong>📧 Email:</strong> {booking.userEmail}</p>
                    <p><strong>🚗 Vehicle:</strong> {booking.registrationNumber}</p>
                    <p><strong>📱 Phone:</strong> {booking.phoneNumber || "N/A"}</p>
                    <p><strong>🅿️ Slot:</strong> <span style={{ fontSize: "1.3em", fontWeight: "700", color: "#667eea" }}>#{booking.slotNumber}</span></p>
                    <p><strong>⏱️ Duration:</strong> {booking.duration} hours</p>
                    <p><strong>📅 Booked At:</strong> {new Date(booking.bookedAt).toLocaleString()}</p>
                    <p><strong>💰 Amount:</strong> <span style={{ color: "#43e97b", fontWeight: "700" }}>₹{booking.amount}</span></p>
                    <p><strong>💳 Payment:</strong> <span style={{ color: booking.paymentStatus === "completed" ? "#43e97b" : "#f5576c" }}>{booking.paymentStatus}</span></p>
                  </div>
                  <button className="btn-release" onClick={() => handleReleaseSlot(booking.id, booking.slotNumber)}>
                    🔓 Release Slot
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>✨ No active bookings</div>
            )}
          </div>

          <h3 style={{ marginTop: "30px", marginBottom: "15px", color: "#f5576c" }}>❌ Cancelled Bookings (Refund Pending)</h3>
          <div className="bookings-list">
            {allBookings && allBookings.filter(b => b.status === "cancelled").length > 0 ? (
              allBookings.filter(b => b.status === "cancelled").map((booking, idx) => (
                <div key={idx} className="booking-item cancelled">
                  <div className="booking-info">
                    <p><strong>👤 User Name:</strong> {booking.userName}</p>
                    <p><strong>📧 Email:</strong> {booking.userEmail}</p>
                    <p><strong>🚗 Vehicle:</strong> {booking.registrationNumber}</p>
                    <p><strong>📱 Phone:</strong> {booking.phoneNumber || "N/A"}</p>
                    <p><strong>🅿️ Slot:</strong> <span style={{ fontSize: "1.3em", fontWeight: "700", color: "#f5576c" }}>#{booking.slotNumber}</span></p>
                    <p><strong>⏱️ Duration:</strong> {booking.duration} hours</p>
                    <p><strong>📅 Cancelled At:</strong> {new Date(booking.cancelledAt || booking.bookedAt).toLocaleString()}</p>
                    <p><strong>💰 Refund Amount:</strong> <span style={{ color: "#f5576c", fontWeight: "700" }}>₹{booking.amount}</span></p>
                    <p><strong>📌 Status:</strong> <span style={{ color: "#f5576c", fontWeight: "700" }}>PENDING REFUND</span></p>
                  </div>
                  <button 
                    className="btn-approve-refund" 
                    onClick={() => handleApproveRefund(booking.id, booking.amount, booking.userName)}
                  >
                    ✅ Approve Refund
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>✨ No cancelled bookings</div>
            )}
          </div>
        </div>
      )}

      {/* Refunds Tab */}
      {activeTab === "refunds" && (
        <div className="admin-section">
          <div className="refunds-header-tab">
            <h2>💰 Refund Management</h2>
          </div>
          
          <div className="refunds-stats">
            <div className="refund-stat-card">
              <h3>Total Pending</h3>
              <p className="stat-number">{pendingRefunds.filter(r => r.status === 'pending').length}</p>
            </div>
            <div className="refund-stat-card">
              <h3>Total Amount</h3>
              <p className="stat-number">₹{pendingRefunds.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0)}</p>
            </div>
            <div className="refund-stat-card">
              <h3>Approved</h3>
              <p className="stat-number">{pendingRefunds.filter(r => r.status === 'approved').length}</p>
            </div>
          </div>

          <h3 style={{ marginTop: "30px", marginBottom: "15px" }}>⏳ Waiting for Approval</h3>
          <div className="refunds-list-tab">
            {pendingRefunds && pendingRefunds.filter(r => r.status === 'pending').length > 0 ? (
              pendingRefunds.filter(r => r.status === 'pending').map((refund, idx) => (
                <div key={idx} className="refund-item-tab">
                  <div className="refund-details">
                    <p><strong>👤 User:</strong> {refund.userName}</p>
                    <p><strong>📧 Email:</strong> {refund.userEmail}</p>
                    <p><strong>🚗 Vehicle:</strong> {refund.registrationNumber}</p>
                    <p><strong>🅿️ Slot #:</strong> {refund.slotNumber}</p>
                    <p><strong>💵 Refund Amount:</strong> <span style={{ color: "#f5576c", fontWeight: "700", fontSize: "1.1em" }}>₹{refund.amount}</span></p>
                  </div>
                  <button 
                    className="btn-approve-refund-tab"
                    onClick={() => handleApproveRefund(refund.id, refund.amount, refund.userName)}
                  >
                    ✅ Approve & Process
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>✨ No pending refunds</div>
            )}
          </div>

          {pendingRefunds.filter(r => r.status === 'approved').length > 0 && (
            <>
              <h3 style={{ marginTop: "30px", marginBottom: "15px" }}>✅ Already Approved</h3>
              <div className="refunds-list-tab">
                {pendingRefunds.filter(r => r.status === 'approved').map((refund, idx) => (
                  <div key={idx} className="refund-item-approved">
                    <div className="refund-details">
                      <p><strong>👤 User:</strong> {refund.userName}</p>
                      <p><strong>💵 Amount:</strong> ₹{refund.amount}</p>
                      <p style={{ color: "#28a745" }}>✅ Refund Approved</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="admin-section">
          <h2>👥 Registered Users ({allUsers.length})</h2>
          <div className="users-list">
            {allUsers && allUsers.length > 0 ? (
              allUsers.map((user, idx) => (
                <div key={idx} className="user-item">
                  <p><strong>👤 Name:</strong> {user.name}</p>
                  <p><strong>📧 Email:</strong> {user.email}</p>
                  <p><strong>🚗 Vehicle:</strong> {user.registrationNumber || "Not provided"}</p>
                  <p><strong>📱 Phone:</strong> {user.phoneNumber || "N/A"}</p>
                  <p><strong>📅 Joined:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>✨ No users found</div>
            )}
          </div>
        </div>
      )}

      {/* Slots Tab */}
      {activeTab === "slots" && stats && (
        <div className="admin-section">
          <h2>🅿️ Parking Slots Status</h2>
          <div className="slots-overview">
            <p>📊 Total: <strong>{stats.totalSlots}</strong> | ✅ Available: <strong style={{ color: "#43e97b" }}>{stats.availableSlots}</strong> | 🚗 Occupied: <strong style={{ color: "#f5576c" }}>{stats.totalSlots - stats.availableSlots}</strong> | 📈 Occupancy: <strong>{Math.round(((stats.totalSlots - stats.availableSlots) / stats.totalSlots) * 100)}%</strong></p>
          </div>
          <div className="slots-grid">
            {Array.from({ length: stats.totalSlots || 10 }).map((_, i) => {
              const slotNum = i + 1;
              const booking = allBookings.find(b => b.slotNumber === slotNum && b.status === "active");
              return (
                <div key={slotNum} className={`slot-box ${booking ? "occupied" : "available"}`} title={booking ? `${booking.userName}` : "Available"}>
                  <p>#{slotNum}</p>
                  <p>{booking ? "🚗" : "✅"}</p>
                  {booking && <button className="btn-mini" onClick={() => handleReleaseSlot(booking.id, slotNum)}>Release</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .refunds-panel {
          background: #fff3cd;
          border: 2px solid #28a745;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
        }

        .refunds-header {
          margin-bottom: 15px;
          font-size: 1.1em;
          color: #155724;
          font-weight: 600;
        }

        .refunds-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .refund-item {
          background: white;
          padding: 15px;
          margin: 10px 0;
          border-left: 4px solid #28a745;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .refund-info p {
          margin: 5px 0;
          font-size: 0.95em;
        }

        .status-pending {
          background: #ffc107;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.85em;
        }

        .btn-approve-refund {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
          transition: background 0.3s ease;
        }

        .btn-approve-refund:hover {
          background: #218838;
        }

        .refunds-header-tab {
          margin-bottom: 20px;
        }

        .refunds-header-tab h2 {
          margin: 0;
          color: #333;
        }

        .refunds-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .refund-stat-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          border-left: 4px solid #667eea;
        }

        .refund-stat-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 0.95em;
          font-weight: 600;
        }

        .refund-stat-card .stat-number {
          margin: 0;
          font-size: 2em;
          font-weight: 700;
          color: #667eea;
        }

        .refunds-list-tab {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .refund-item-tab {
          background: white;
          border: 2px solid #f0f0f0;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .refund-item-tab:hover {
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          border-color: #667eea;
        }

        .refund-details {
          flex: 1;
        }

        .refund-details p {
          margin: 8px 0;
          font-size: 0.95em;
          color: #333;
        }

        .btn-approve-refund-tab {
          background: #28a745;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
          margin-left: 20px;
          transition: all 0.3s ease;
          font-size: 0.95em;
        }

        .btn-approve-refund-tab:hover {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
        }

        .refund-item-approved {
          background: #f0f8f0;
          border: 2px solid #28a745;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          opacity: 0.8;
        }

        .notifications-panel {
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
        }

        .notifications-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .notifications-header h3 {
          margin: 0;
          color: #856404;
          font-size: 1.1em;
        }

        .btn-clear-notifications {
          background: #ffc107;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.3s ease;
        }

        .btn-clear-notifications:hover {
          background: #ffb300;
        }

        .notifications-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .notification-item {
          background: white;
          padding: 12px;
          margin: 8px 0;
          border-left: 4px solid #ffc107;
          border-radius: 6px;
          color: #856404;
        }

        .notification-item p {
          margin: 5px 0;
          font-weight: 500;
        }

        .notification-item small {
          color: #999;
          font-size: 0.85em;
        }

        .bookings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .btn-refresh {
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.3s ease;
        }

        .btn-refresh:hover {
          background: #5568d3;
        }
      `}</style>
    </div>
  );
}
