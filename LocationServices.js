import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LocationServices() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyParkings, setNearbyParkings] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParking, setSelectedParking] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);

  // Mock parking locations (in a real app, these would be in your backend)
  const PARKING_LOCATIONS = {
    1: { lat: 28.6139, lng: 77.209, name: "Downtown Mall Parking", address: "Central Delhi", distance: 0.5 },
    2: { lat: 28.6245, lng: 77.2217, name: "Metro Station Parking", address: "Kasturba Nagar", distance: 1.2 },
    3: { lat: 28.5721, lng: 77.1884, name: "Airport Parking", address: "Near T3", distance: 3.5 },
    4: { lat: 28.6353, lng: 77.2245, name: "Hospital Parking", address: "Medical District", distance: 0.8 },
    5: { lat: 28.6129, lng: 77.2295, name: "Shopping Complex", address: "Commercial Hub", distance: 1.5 },
    6: { lat: 28.5941, lng: 77.1521, name: "Tech Park Parking", address: "IT Corridor", distance: 4.2 },
    7: { lat: 28.6355, lng: 77.1994, name: "University Parking", address: "Educational Zone", distance: 2.1 },
    8: { lat: 28.5920, lng: 77.2414, name: "Railway Station", address: "Transport Hub", distance: 2.8 },
    9: { lat: 28.6047, lng: 77.1827, name: "Business District", address: "Corporate Area", distance: 1.8 },
    10: { lat: 28.6335, lng: 77.2197, name: "Entertainment Zone", address: "Night Life Area", distance: 2.3 },
  };

  useEffect(() => {
    const userToken = localStorage.getItem("userToken") || localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail");
    if (!userToken || !userEmail) {
      navigate("/login");
      return;
    }

    fetchAllSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    requestUserLocation();
  }, [navigate]);

  const requestUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setLocationEnabled(true);
          calculateNearbyParkings(latitude, longitude);
        },
        () => {
          setError("Please enable location access to see nearby parkings");
          setLocationEnabled(false);
          // Show default parkings without distance
          showDefaultParkings();
        }
      );
    } else {
      setError("Geolocation not supported by your browser");
      showDefaultParkings();
    }
  };

  const showDefaultParkings = () => {
    const parkings = Object.entries(PARKING_LOCATIONS).map(([slot, details]) => ({
      slotNumber: parseInt(slot),
      ...details,
      distance: null,
    }));
    setNearbyParkings(parkings);
  };

  const calculateNearbyParkings = (userLat, userLng) => {
    const parkings = Object.entries(PARKING_LOCATIONS).map(([slot, details]) => {
      // Simple distance calculation (in real app, use proper geo library)
      const dLat = details.lat - userLat;
      const dLng = details.lng - userLng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // Approximate km conversion

      return {
        slotNumber: parseInt(slot),
        ...details,
        distance: parseFloat(distance.toFixed(1)),
      };
    });

    // Sort by distance
    parkings.sort((a, b) => a.distance - b.distance);
    setNearbyParkings(parkings);
  };

  const fetchAllSlots = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/slots");
      if (response.ok) {
        const data = await response.json();
        setAllSlots(data.slots || data || []);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    }
    setLoading(false);
  };

  const getSlotStatus = (slotNumber) => {
    if (!Array.isArray(allSlots)) {
      return true;
    }
    const slot = allSlots.find((s) => s.id === slotNumber);
    return slot ? !slot.booked : true;
  };

  const handleBookParking = (parking) => {
    // Navigate to payment with slot pre-selected
    navigate("/payment", { state: { slotNumber: parking.slotNumber } });
  };

  const handleEnableLocation = () => {
    requestUserLocation();
  };

  return (
    <div className="location-container">
      {/* Header */}
      <div className="location-header">
        <div className="header-top">
          <h1>🗺️ Find Nearby Parking</h1>
          <button onClick={() => navigate("/dashboard")} className="btn-back" title="Back to Dashboard">
            ← Back
          </button>
        </div>
        <p>
          {locationEnabled && userLocation
            ? `📍 Your Location: (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`
            : "Enable location to find nearest parkings"}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="location-error">
          <p>⚠️ {error}</p>
          <button onClick={handleEnableLocation} className="btn-primary">
            📍 Enable Location Access
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-section">
          <p>Finding nearby parkings...</p>
        </div>
      ) : (
        <div className="location-content">
          {/* Map Placeholder */}
          <div className="map-section">
            <div className="map-placeholder">
              <div className="map-header">
                <h3>Parking Locations Map</h3>
                <p className="map-info">
                  {nearbyParkings.length} parking spots available nearby
                </p>
              </div>

              {userLocation && locationEnabled && (
                <div className="location-stats">
                  <p>
                    <strong>Closest Parking:</strong> {nearbyParkings[0]?.name} ({nearbyParkings[0]?.distance} km away)
                  </p>
                  <p>
                    <strong>Average Distance:</strong>{" "}
                    {(nearbyParkings.reduce((sum, p) => sum + p.distance, 0) /
                      nearbyParkings.length).toFixed(1)} km
                  </p>
                </div>
              )}

              <div className="map-content">
                {/* Simple grid visualization */}
                <div className="parking-grid-visual">
                  {nearbyParkings.slice(0, 5).map((parking, idx) => (
                    <div key={idx} className="parking-pin">
                      <span className="pin-number">{parking.slotNumber}</span>
                      <span className="pin-name">{parking.distance ? `${parking.distance}km` : "?"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleEnableLocation}
                className="btn-secondary"
                style={{ marginTop: "15px" }}
              >
                Refresh Location
              </button>
            </div>
          </div>

          {/* Parkings List */}
          <div className="parkings-list-section">
            <h2>Available Parkings Near You</h2>

            {/* Filters */}
            <div className="location-filters">
              <button className="filter-btn active">All ({nearbyParkings.length})</button>
              <button className="filter-btn">
                Within 1 km ({nearbyParkings.filter((p) => p.distance && p.distance <= 1).length})
              </button>
              <button className="filter-btn">
                Within 2 km ({nearbyParkings.filter((p) => p.distance && p.distance <= 2).length})
              </button>
            </div>

            {/* Parkings List */}
            <div className="parkings-list">
              {nearbyParkings.map((parking, idx) => {
                const isAvailable = getSlotStatus(parking.slotNumber);
                return (
                  <div
                    key={idx}
                    className={`parking-card ${isAvailable ? "available" : "occupied"}`}
                    onClick={() => setSelectedParking(parking.slotNumber)}
                  >
                    <div className="parking-card-header">
                      <h3>
                        Slot {parking.slotNumber} - {parking.name}
                      </h3>
                      <span className={`status-badge ${isAvailable ? "available" : "occupied"}`}>
                        {isAvailable ? "AVAILABLE" : "OCCUPIED"}
                      </span>
                    </div>

                    <div className="parking-card-details">
                      <p>
                        <strong>Location:</strong> {parking.address}
                      </p>
                      {parking.distance !== null && (
                        <p>
                          <strong>Distance:</strong> {parking.distance} km away
                        </p>
                      )}

                      <div className="parking-amenities">
                        <span className="amenity">Secure</span>
                        <span className="amenity">CCTV</span>
                        <span className="amenity">Lighted</span>
                        <span className="amenity">Accessible</span>
                      </div>
                    </div>

                    <div className="parking-price">
                      <p>
                        <strong>₹50/hr</strong> - 1 hour
                      </p>
                      <p style={{ fontSize: "0.9em", color: "#999" }}>
                        ₹100 for 2 hrs | ₹150 for 3 hrs
                      </p>
                    </div>

                    {isAvailable && (
                      <button
                        className="btn-book-parking"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookParking(parking);
                        }}
                      >
                        Book Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected Parking Details */}
      {selectedParking && (
        <div className="parking-detail-modal">
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => setSelectedParking(null)}
            >
              ✕
            </button>

            {nearbyParkings.find((p) => p.slotNumber === selectedParking) && (
              <div>
                <h2>
                  {nearbyParkings.find((p) => p.slotNumber === selectedParking)?.name}
                </h2>
                <p className="modal-address">
                  {nearbyParkings.find((p) => p.slotNumber === selectedParking)?.address}
                </p>

                <div className="modal-info">
                  <h3>Details</h3>
                  <p>
                    <strong>Slot Number:</strong> {selectedParking}
                  </p>
                  <p>
                    <strong>Distance:</strong>{" "}
                    {nearbyParkings.find((p) => p.slotNumber === selectedParking)?.distance} km
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {getSlotStatus(selectedParking) ? "Available" : "Occupied"}
                  </p>
                </div>

                <div className="modal-info">
                  <h3>Pricing</h3>
                  <p>1 Hour - ₹50</p>
                  <p>2 Hours - ₹100</p>
                  <p>3 Hours - ₹150</p>
                </div>

                {getSlotStatus(selectedParking) && (
                  <button
                    className="btn-primary btn-large"
                    onClick={() => {
                      handleBookParking(
                        nearbyParkings.find((p) => p.slotNumber === selectedParking)
                      );
                    }}
                  >
                    Proceed to Booking
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
