import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

const API_URL = "http://localhost:5000/api";

export default function App() {
  const [slots, setSlots] = useState([]);
  const [available, setAvailable] = useState(0);
  const [booked, setBooked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myBookings, setMyBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    setUser(userData ? JSON.parse(userData) : null);
    fetchSlots();
    fetchMyBookings();
    
    const timer = setInterval(() => {
      fetchSlots();
      fetchMyBookings();
    }, 2000);
    
    return () => clearInterval(timer);
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${API_URL}/slots`);
      const data = await res.json();
      setSlots(data.slots);
      setAvailable(data.available);
      setBooked(data.booked);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching slots:", error);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const cancelBooking = async (slotNumber) => {
    if (!window.confirm("Cancel this booking?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/bookings/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slotNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Booking cancelled successfully");
        fetchSlots();
        fetchMyBookings();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Cancellation error:", error);
      setMessage("❌ Cancellation failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userToken");
    localStorage.removeItem("userEmail");
    navigate("/login");
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Smart Parking System</h1>
          <p>Book your perfect spot</p>
        </div>
        <div className="header-user">
          <span className="user-name">{user?.name || "User"}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {/* Message */}
      {message && <div className="message-alert">{message}</div>}

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat">
          <span className="stat-number">{available}</span>
          <span className="stat-label">Available</span>
        </div>
        <div className="stat">
          <span className="stat-number">{booked}</span>
          <span className="stat-label">Booked</span>
        </div>
        <div className="stat">
          <span className="stat-number">{slots.length}</span>
          <span className="stat-label">Total</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Left: Quick Actions */}
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button onClick={() => navigate("/location")} className="action-btn find-parking">
              Find Parking Near Me
            </button>
            <button onClick={() => navigate("/payment")} className="action-btn make-payment">
              Make Payment
            </button>
            <button onClick={() => navigate("/profile")} className="action-btn edit-profile">
              Edit Profile
            </button>
            <button onClick={() => navigate("/admin-login")} className="action-btn admin-access">
              Admin Dashboard
            </button>
          </div>
        </section>

        {/* Right: My Bookings */}
        <section className="my-bookings-section">
          <h2>My Active Bookings</h2>
          
          {myBookings.length === 0 ? (
            <div className="empty-bookings">
              <p>No active bookings</p>
              <p className="empty-subtitle">Book a parking spot to get started</p>
            </div>
          ) : (
            <div className="bookings-container">
              {myBookings.map((booking, idx) => (
                <div key={idx} className="booking-card">
                  <div className="booking-header">
                    <h3>Slot {booking.slot}</h3>
                    <span className="booking-status">Active</span>
                  </div>
                  
                  <div className="booking-details">
                    <p>
                      <strong>Vehicle:</strong> {booking.registrationNumber}
                    </p>
                    <p>
                      <strong>Duration:</strong> {booking.hours} hour{booking.hours > 1 ? "s" : ""}
                    </p>
                    <p>
                      <strong>Amount Paid:</strong> ₹{booking.amount}
                    </p>
                    <p className="booking-time">
                      {booking.bookedTime}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => cancelBooking(booking.slot)}
                    className="btn-cancel-booking"
                  >
                    ✕ Cancel Booking
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Available Slots Grid */}
      <section className="slots-section">
        <h2>Parking Slots Status</h2>
        <div className="slots-grid">
          {slots.map((slot) => (
            <div
              key={slot._id}
              className={`slot-card ${slot.booked ? "booked" : "available"}`}
            >
              <div className="slot-number">#{slot.id}</div>
              <div className="slot-indicator">
                {slot.booked ? (
                  <>
                    <span className="status-dot booked"></span>
                    <span className="status-text">Booked</span>
                  </>
                ) : (
                  <>
                    <span className="status-dot available"></span>
                    <span className="status-text">Free</span>
                  </>
                )}
              </div>
              {slot.booked && slot.registrationNumber && (
                <div className="slot-vehicle">{slot.registrationNumber}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
