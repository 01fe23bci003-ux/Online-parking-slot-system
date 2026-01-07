import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Payment() {
  const navigate = useNavigate();
  const [selectedSlot, setSelectedSlot] = useState("");
  const [duration, setDuration] = useState(1);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState(null);
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  });

  const RATES = {
    1: 50,
    2: 100,
    3: 150,
  };

  useEffect(() => {
    const userToken = localStorage.getItem("userToken") || localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail");
    if (!userToken || !userEmail) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAmount(RATES[duration] || 50);
  }, [duration]);

  const handleCardChange = (field, value) => {
    let formattedValue = value;

    if (field === "cardNumber") {
      formattedValue = value.replace(/\s/g, "").slice(0, 16);
      formattedValue = formattedValue.replace(/(\d{4})/g, "$1 ").trim();
    } else if (field === "expiryDate") {
      formattedValue = value.replace(/\D/g, "").slice(0, 4);
      if (formattedValue.length >= 2) {
        formattedValue = formattedValue.slice(0, 2) + "/" + formattedValue.slice(2);
      }
    } else if (field === "cvv") {
      formattedValue = value.replace(/\D/g, "").slice(0, 3);
    }

    setCardDetails({
      ...cardDetails,
      [field]: formattedValue,
    });
  };

  const validateCardDetails = () => {
    if (!cardDetails.cardNumber.replace(/\s/g, "").match(/^\d{16}$/)) {
      setError("Card number must be 16 digits");
      return false;
    }
    if (!cardDetails.expiryDate.match(/^\d{2}\/\d{2}$/)) {
      setError("Expiry date must be MM/YY format");
      return false;
    }
    if (!cardDetails.cvv.match(/^\d{3}$/)) {
      setError("CVV must be 3 digits");
      return false;
    }
    if (!cardDetails.cardholderName.trim()) {
      setError("Cardholder name is required");
      return false;
    }
    return true;
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedSlot) {
      setError("Please select a slot");
      return;
    }

    if (!validateCardDetails()) {
      return;
    }

    setLoading(true);

    try {
      const userEmail = localStorage.getItem("userEmail");
      const userToken = localStorage.getItem("userToken");

      const paymentData = {
        slotNumber: selectedSlot,
        duration: duration,
        amount: amount,
        email: userEmail,
        cardDetails: {
          last4: cardDetails.cardNumber.slice(-4),
          name: cardDetails.cardholderName,
        },
      };

      const response = await fetch("http://localhost:5000/api/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Payment successful! Booking ID: ${result.bookingId}`);
        // Reset form
        setSelectedSlot("");
        setDuration(1);
        setCardDetails({
          cardNumber: "",
          expiryDate: "",
          cvv: "",
          cardholderName: "",
        });

        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        setError("Payment failed. Please try again.");
      }
    } catch (error) {
      setError("Error processing payment: " + error.message);
    }

    setLoading(false);
  };

  return (
    <div className="payment-container">
      <div className="payment-header">
        <div className="header-top">
          <h1>Payment Portal</h1>
          <button onClick={() => navigate("/dashboard")} className="btn-back" title="Back to Dashboard">
            ← Back
          </button>
        </div>
        <p>Secure Parking Slot Booking Payment</p>
      </div>

      <div className="payment-content">
        {/* Left Side - Payment Details */}
        <div className="payment-form-section">
          <form onSubmit={handlePayment}>
            <div className="form-section">
              <h3>Booking Details</h3>

              <div className="form-group">
                <label>Select Parking Slot *</label>
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  required
                >
                  <option value="">Choose a slot...</option>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Slot {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Duration (Hours) *</label>
                <div className="duration-selector">
                  {[1, 2, 3].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      className={`duration-btn ${duration === hrs ? "active" : ""}`}
                      onClick={() => setDuration(hrs)}
                    >
                      {hrs}h <br /> ₹{RATES[hrs]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Card Details</h3>

              <div className="form-group">
                <label>Cardholder Name *</label>
                <input
                  type="text"
                  value={cardDetails.cardholderName}
                  onChange={(e) =>
                    handleCardChange("cardholderName", e.target.value)
                  }
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Card Number *</label>
                <input
                  type="text"
                  value={cardDetails.cardNumber}
                  onChange={(e) => handleCardChange("cardNumber", e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  maxLength="19"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date *</label>
                  <input
                    type="text"
                    value={cardDetails.expiryDate}
                    onChange={(e) =>
                      handleCardChange("expiryDate", e.target.value)
                    }
                    placeholder="MM/YY"
                    maxLength="5"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CVV *</label>
                  <input
                    type="text"
                    value={cardDetails.cvv}
                    onChange={(e) => handleCardChange("cvv", e.target.value)}
                    placeholder="123"
                    maxLength="3"
                    required
                  />
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary btn-large">
              {loading ? "Processing..." : `Pay ₹${amount}`}
            </button>
          </form>
        </div>

        {/* Right Side - Order Summary */}
        <div className="payment-summary">
          <div className="summary-box">
            <h3>Order Summary</h3>

            <div className="summary-item">
              <span>Selected Slot:</span>
              <strong>{selectedSlot || "Not selected"}</strong>
            </div>
            <div className="summary-item">
              <span>Duration:</span>
              <strong>{duration} Hour{duration > 1 ? "s" : ""}</strong>
            </div>

            <hr />

            <div className="summary-item summary-total">
              <span>Total Amount:</span>
              <strong className="amount">₹{amount}</strong>
            </div>

            <div className="payment-info">
              <h4>What's Included:</h4>
              <ul>
                <li>Secure parking spot</li>
                <li>Real-time slot tracking</li>
                <li>24/7 monitoring</li>
                <li>Quick booking cancellation</li>
                <li>SMS notifications</li>
              </ul>
            </div>

            <div className="security-badge">
              <strong>Secure & Encrypted</strong>
              <p>Your payment is protected</p>
            </div>

            <p className="test-card-info">
              <strong>Test Card:</strong> <br />
              4111 1111 1111 1111 <br />
              Any future date & any 3-digit CVV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
