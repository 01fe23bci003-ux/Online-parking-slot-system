const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/smart-parking";
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_change_this_in_production";

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory data storage (fallback if MongoDB not available)
let dbConnected = false;
let memoryDB = {
  users: [],
  slots: Array.from({ length: 10 }, (_, i) => ({
    _id: `slot_${i + 1}`,
    id: i + 1,
    booked: false,
    endTime: null,
    registrationNumber: null,
    userId: null
  })),
  bookingHistory: []
};

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✅ MongoDB Connected");
    dbConnected = true;
  })
  .catch((err) => {
    console.log("⚠️  MongoDB not available, using in-memory storage");
    console.log("   Error:", err.message);
    dbConnected = false;
  });

// ============ DATABASE SCHEMAS ============

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  registrationNumber: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Slot Schema
const slotSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  booked: { type: Boolean, default: false },
  endTime: { type: Date, default: null },
  registrationNumber: { type: String, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
});

// Booking History Schema
const bookingHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  slot: { type: Number, required: true },
  registrationNumber: { type: String, required: true },
  hours: { type: Number, required: true },
  amount: { type: Number, required: true },
  paymentStatus: { type: String, default: "completed" }, // pending, completed, failed
  stripePaymentId: { type: String, default: null },
  bookedTime: { type: Date, default: Date.now },
  endTime: { type: Date, required: true },
  status: { type: String, default: "active" }, // active, released, cancelled, expired
  createdAt: { type: Date, default: Date.now },
});

// Create Models
const User = mongoose.model("User", userSchema);
const Slot = mongoose.model("Slot", slotSchema);
const BookingHistory = mongoose.model("BookingHistory", bookingHistorySchema);

// ============ MIDDLEWARE ============

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ============ INITIALIZE DATABASE ============

async function initializeSlots() {
  if (!dbConnected) {
    console.log("✅ In-memory slots initialized (10 slots)");
    return;
  }
  
  try {
    const count = await Slot.countDocuments();
    if (count === 0) {
      const slots = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        booked: false,
        endTime: null,
        registrationNumber: null,
      }));
      await Slot.insertMany(slots);
      console.log("✅ 10 parking slots initialized in MongoDB");
    }
  } catch (error) {
    console.log("Error initializing slots:", error.message);
  }
}

initializeSlots();

// ============ CLEANUP EXPIRED BOOKINGS ============

setInterval(async () => {
  if (!dbConnected) {
    // Clean up in-memory data
    const now = new Date();
    memoryDB.slots.forEach(slot => {
      if (slot.booked && slot.endTime && slot.endTime < now) {
        slot.booked = false;
        slot.endTime = null;
        slot.registrationNumber = null;
        slot.userId = null;
      }
    });
    return;
  }

  try {
    const now = new Date();
    const expiredSlots = await Slot.find({
      booked: true,
      endTime: { $lt: now },
    });

    for (let slot of expiredSlots) {
      await Slot.updateOne(
        { _id: slot._id },
        { booked: false, endTime: null, registrationNumber: null, userId: null }
      );
    }
  } catch (error) {
    console.log("Cleanup error:", error);
  }
}, 1000);

// ============ AUTH ROUTES ============

// Register User
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, registrationNumber, phoneNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      registrationNumber,
      phoneNumber,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        registrationNumber: user.registrationNumber,
      },
    });
  } catch (error) {
    console.log("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login User
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        registrationNumber: user.registrationNumber,
      },
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get User Profile
app.get("/api/auth/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Update User Profile
app.put("/api/auth/profile", verifyToken, async (req, res) => {
  try {
    const { name, registrationNumber, phoneNumber } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, registrationNumber, phoneNumber },
      { new: true }
    ).select("-password");

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ============ SLOT ROUTES ============

// Get all slots
app.get("/api/slots", async (req, res) => {
  try {
    let slots;
    
    if (!dbConnected) {
      slots = memoryDB.slots;
    } else {
      slots = await Slot.find().sort({ id: 1 });
    }
    
    const available = slots.filter((s) => !s.booked).length;
    const booked = slots.filter((s) => s.booked).length;

    res.json({
      slots,
      available,
      booked,
      total: slots.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// Book a slot
app.post("/api/slots/book", verifyToken, async (req, res) => {
  try {
    const { slotId, hours, registrationNumber } = req.body;

    if (!slotId || !hours || !registrationNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const slot = await Slot.findOne({ id: parseInt(slotId) });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    if (slot.booked) {
      return res.status(400).json({ error: "Slot already booked" });
    }

    const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    const amount = { 1: 50, 2: 100, 3: 150 }[hours] || 0;

    // Update slot
    await Slot.updateOne(
      { id: parseInt(slotId) },
      {
        booked: true,
        endTime,
        registrationNumber,
        userId: req.userId,
      }
    );

    // Add to booking history
    const booking = new BookingHistory({
      userId: req.userId,
      slot: slotId,
      registrationNumber,
      hours,
      amount,
      endTime,
      paymentStatus: "completed",
    });

    await booking.save();

    res.json({
      success: true,
      message: "Slot booked successfully",
      booking: {
        id: booking._id,
        slot: slotId,
        registrationNumber,
        hours,
        amount,
        bookedTime: booking.bookedTime.toLocaleString(),
        endTime: endTime.toLocaleString(),
      },
    });
  } catch (error) {
    console.log("Booking error:", error);
    res.status(500).json({ error: "Failed to book slot" });
  }
});

// Cancel booking
app.post("/api/slots/cancel/:slotId", verifyToken, async (req, res) => {
  try {
    const slotId = parseInt(req.params.slotId);
    const slot = await Slot.findOne({ id: slotId });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    if (!slot.booked) {
      return res.status(400).json({ error: "Slot is not booked" });
    }

    await Slot.updateOne(
      { id: slotId },
      { booked: false, endTime: null, registrationNumber: null, userId: null }
    );

    res.json({ success: true, message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// Get booking history
app.get("/api/history", async (req, res) => {
  try {
    const history = await BookingHistory.find().sort({ createdAt: -1 });

    const formattedHistory = history.map((h) => ({
      id: h._id,
      slot: h.slot,
      registrationNumber: h.registrationNumber,
      hours: h.hours,
      amount: h.amount,
      paymentStatus: h.paymentStatus,
      bookedTime: h.bookedTime.toLocaleString(),
      endTime: h.endTime.toLocaleString(),
    }));

    res.json(formattedHistory);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Get user booking history
app.get("/api/my-bookings", verifyToken, async (req, res) => {
  try {
    if (dbConnected) {
      const bookings = await BookingHistory.find({ 
        userId: req.userId,
        status: "active"
      }).sort({ createdAt: -1 });

      const formattedBookings = bookings.map((b) => ({
        id: b._id,
        slot: b.slot,
        registrationNumber: b.registrationNumber,
        hours: b.hours,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        bookedTime: b.bookedTime.toLocaleString(),
        endTime: b.endTime.toLocaleString(),
      }));

      res.json(formattedBookings);
    } else {
      // In-memory fallback
      const bookings = memoryDB.bookingHistory.filter(
        (b) => b.userId === req.userId && b.status === "active"
      );
      const formattedBookings = bookings.map((b) => ({
        id: b._id,
        slot: b.slot,
        registrationNumber: b.registrationNumber,
        hours: b.hours,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        bookedTime: new Date(b.bookedTime).toLocaleString(),
        endTime: new Date(b.endTime).toLocaleString(),
      }));
      res.json(formattedBookings);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Cancel booking
app.post("/api/bookings/cancel", verifyToken, async (req, res) => {
  try {
    const { slotNumber } = req.body;

    if (dbConnected) {
      // Find and update the booking to mark as cancelled
      const booking = await BookingHistory.findOne({
        userId: req.userId,
        slot: slotNumber,
        status: "active"
      });

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Mark the booking as cancelled instead of deleting
      booking.status = "cancelled";
      await booking.save();

      // Free up the slot
      const slot = await Slot.findOne({ id: slotNumber });
      if (slot) {
        slot.booked = false;
        slot.endTime = null;
        slot.registrationNumber = null;
        slot.userId = null;
        await slot.save();
      }

      res.json({ success: true, message: "Booking cancelled successfully" });
    } else {
      // In-memory fallback
      const booking = memoryDB.bookingHistory.find(
        (b) => b.userId === req.userId && b.slot === slotNumber && b.status === "active"
      );

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      booking.status = "cancelled";

      const slot = memoryDB.slots.find((s) => s.id === slotNumber);
      if (slot) {
        slot.booked = false;
        slot.endTime = null;
        slot.registrationNumber = null;
        slot.userId = null;
      }

      res.json({ success: true, message: "Booking cancelled successfully" });
    }
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// ============ PAYMENT ROUTES (STRIPE) ============

// Create Payment Intent
app.post("/api/payment/create-intent", verifyToken, async (req, res) => {
  try {
    const { amount, slotId } = req.body;

    if (!amount || !slotId) {
      return res.status(400).json({ error: "Missing amount or slotId" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "inr",
      metadata: {
        slotId,
        userId: req.userId.toString(),
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.log("Payment intent error:", error);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// Confirm Payment
app.post("/api/payment/confirm", verifyToken, async (req, res) => {
  try {
    const { paymentIntentId, slotId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Update booking with payment status
      await BookingHistory.findOneAndUpdate(
        { userId: req.userId, slot: slotId },
        {
          paymentStatus: "completed",
          stripePaymentId: paymentIntentId,
        }
      );

      res.json({ success: true, message: "Payment confirmed" });
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

// ============ ADMIN ROUTES ============

// In-memory storage for recent cancellations (for real-time updates)
let recentCancellations = [];

// Reset all slots (Admin only)
app.post("/api/admin/reset", async (req, res) => {
  try {
    await Slot.deleteMany({});
    await BookingHistory.deleteMany({});

    const slots = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      booked: false,
      endTime: null,
      registrationNumber: null,
    }));

    await Slot.insertMany(slots);

    res.json({ success: true, message: "All data reset" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset" });
  }
});

// Get Dashboard Stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    if (dbConnected) {
      const totalUsers = await User.countDocuments();
      const totalBookings = await BookingHistory.countDocuments({ status: "active" });
      // Only count revenue from active (completed) bookings
      const totalRevenue = await BookingHistory.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const slots = await Slot.find();
      const bookedSlots = slots.filter((s) => s.booked).length;
      const bookings = await BookingHistory.find({ status: "active" }).populate("userId", "name email registrationNumber phoneNumber");
      const cancelledBookings = await BookingHistory.find({ status: "cancelled" }).populate("userId", "name email registrationNumber phoneNumber");

      res.json({
        stats: {
          totalUsers,
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          occupancyRate: ((bookedSlots / slots.length) * 100).toFixed(1),
          activeBookings: bookedSlots,
          availableSlots: slots.length - bookedSlots,
          totalSlots: slots.length,
        },
        bookings: [
          ...bookings.map((b) => ({
            id: b._id,
            userName: b.userId?.name || "Unknown",
            userEmail: b.userId?.email || "Unknown",
            registrationNumber: b.userId?.registrationNumber || "N/A",
            phoneNumber: b.userId?.phoneNumber || "N/A",
            slotNumber: b.slot,
            duration: b.hours,
            bookedAt: b.bookedTime,
            amount: b.amount,
            status: "active",
            paymentStatus: b.paymentStatus,
          })),
          ...cancelledBookings.map((b) => ({
            id: b._id,
            userName: b.userId?.name || "Unknown",
            userEmail: b.userId?.email || "Unknown",
            registrationNumber: b.userId?.registrationNumber || "N/A",
            phoneNumber: b.userId?.phoneNumber || "N/A",
            slotNumber: b.slot,
            duration: b.hours,
            bookedAt: b.bookedTime,
            cancelledAt: b.createdAt,
            amount: b.amount,
            status: "cancelled",
            paymentStatus: b.paymentStatus,
          })),
        ],
        users: await User.find({}, "-password"),
      });
    } else {
      // In-memory fallback
      const users = memoryDB.users;
      const bookings = memoryDB.bookingHistory.filter((b) => b.status === "active");
      const cancelledBookings = memoryDB.bookingHistory.filter((b) => b.status === "cancelled");
      const slots = memoryDB.slots;
      const bookedSlots = slots.filter((s) => s.booked).length;
      // Count revenue only from completed bookings (active ones)
      const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);

      res.json({
        stats: {
          totalUsers: users.length,
          totalBookings: bookings.length,
          totalRevenue,
          occupancyRate: ((bookedSlots / slots.length) * 100).toFixed(1),
          activeBookings: bookedSlots,
          availableSlots: slots.length - bookedSlots,
          totalSlots: slots.length,
        },
        bookings: [
          ...bookings.map((b) => ({
            id: b._id,
            userName: users.find((u) => u._id === b.userId)?.name || "Unknown",
            userEmail: users.find((u) => u._id === b.userId)?.email || "Unknown",
            registrationNumber: users.find((u) => u._id === b.userId)?.vehicleRegistration || "N/A",
            phoneNumber: users.find((u) => u._id === b.userId)?.phoneNumber || "N/A",
            slotNumber: b.slot,
            duration: b.hours,
            bookedAt: b.bookedTime,
            amount: b.amount,
            status: "active",
            paymentStatus: b.paymentStatus,
          })),
          ...cancelledBookings.map((b) => {
            const user = users.find((u) => u._id === b.userId);
            return {
              id: b._id,
              userName: user?.name || "Unknown",
              userEmail: user?.email || "Unknown",
              registrationNumber: user?.vehicleRegistration || "N/A",
              phoneNumber: user?.phoneNumber || "N/A",
              slotNumber: b.slot,
              duration: b.hours,
              bookedAt: b.bookedTime,
              cancelledAt: b.createdAt,
              amount: b.amount,
              status: "cancelled",
              paymentStatus: b.paymentStatus,
            };
          }),
        ],
        users: users.map(({ password, ...u }) => u),
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Release a slot (Admin)
app.post("/api/admin/release-slot/:slotId", async (req, res) => {
  try {
    const slotId = parseInt(req.params.slotId);

    if (dbConnected) {
      // Find the slot
      const slot = await Slot.findOne({ id: slotId });
      if (slot) {
        // Mark the booking as released in BookingHistory
        if (slot.userId) {
          await BookingHistory.findOneAndUpdate(
            { userId: slot.userId, slot: slotId, status: "active" },
            { status: "released" }
          );
        }
        
        // Clear the slot
        slot.booked = false;
        slot.endTime = null;
        slot.registrationNumber = null;
        slot.userId = null;
        await slot.save();
      }
    } else {
      // In-memory fallback
      const slot = memoryDB.slots.find((s) => s.id === slotId);
      if (slot) {
        // Mark the booking as released in memory
        if (slot.userId) {
          const booking = memoryDB.bookingHistory.find(
            (b) => b.userId === slot.userId && b.slot === slotId && b.status === "active"
          );
          if (booking) {
            booking.status = "released";
          }
        }
        
        // Clear the slot
        slot.booked = false;
        slot.endTime = null;
        slot.registrationNumber = null;
        slot.userId = null;
      }
    }

    res.json({ success: true, message: "Slot released" });
  } catch (error) {
    res.status(500).json({ error: "Failed to release slot" });
  }
});

// Get all bookings (Admin)
app.get("/api/admin/bookings", async (req, res) => {
  try {
    if (dbConnected) {
      const bookings = await BookingHistory.find().populate("userId", "name email");
      res.json(bookings);
    } else {
      res.json(memoryDB.bookingHistory);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Get all users (Admin)
app.get("/api/admin/users", async (req, res) => {
  try {
    if (dbConnected) {
      const users = await User.find({}, "-password");
      res.json(users);
    } else {
      res.json(memoryDB.users.map(({ password, ...u }) => u));
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get recent cancellations (for real-time notifications)
app.get("/api/admin/cancellations", async (req, res) => {
  try {
    if (dbConnected) {
      const cancellations = await BookingHistory.find({ status: "cancelled" })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("userId", "name email");
      
      res.json(
        cancellations.map((c) => ({
          id: c._id,
          userName: c.userId?.name || "Unknown",
          userEmail: c.userId?.email || "Unknown",
          slotNumber: c.slot,
          amount: c.amount,
          cancelledAt: c.createdAt,
          message: `User ${c.userId?.name || "Unknown"} cancelled booking for slot ${c.slot}`,
        }))
      );
    } else {
      const users = memoryDB.users;
      const cancellations = memoryDB.bookingHistory
        .filter((b) => b.status === "cancelled")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);
      
      res.json(
        cancellations.map((c) => {
          const user = users.find((u) => u._id === c.userId);
          return {
            id: c._id,
            userName: user?.name || "Unknown",
            userEmail: user?.email || "Unknown",
            slotNumber: c.slot,
            amount: c.amount,
            cancelledAt: c.createdAt,
            message: `User ${user?.name || "Unknown"} cancelled booking for slot ${c.slot}`,
          };
        })
      );
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cancellations" });
  }
});

// Approve refund (Admin only)
app.post("/api/admin/approve-refund", async (req, res) => {
  try {
    const { refundId, amount, userName } = req.body;

    if (dbConnected) {
      // Find the refund record
      const booking = await BookingHistory.findById(refundId);
      if (!booking) {
        return res.status(404).json({ error: "Refund not found" });
      }

      // Mark booking as refunded
      booking.refundStatus = "approved";
      booking.refundAmount = amount;
      booking.refundApprovedAt = new Date();
      await booking.save();

      res.json({ 
        success: true, 
        message: `Refund of ₹${amount} approved for ${userName}` 
      });
    } else {
      // In-memory fallback
      const booking = memoryDB.bookingHistory.find(b => b._id === refundId);
      if (!booking) {
        return res.status(404).json({ error: "Refund not found" });
      }

      booking.refundStatus = "approved";
      booking.refundAmount = amount;
      booking.refundApprovedAt = new Date();

      res.json({ 
        success: true, 
        message: `Refund of ₹${amount} approved for ${userName}` 
      });
    }
  } catch (error) {
    console.error("Refund approval error:", error);
    res.status(500).json({ error: "Failed to approve refund" });
  }
});

// ============ LOCATION & MAPPING ROUTES ============

// Get parking locations with available slots
app.get("/api/locations", async (req, res) => {
  try {
    const locations = [
      { id: 1, name: "Downtown Mall Parking", lat: 28.6139, lng: 77.209, address: "Central Delhi" },
      { id: 2, name: "Metro Station Parking", lat: 28.6245, lng: 77.2217, address: "Kasturba Nagar" },
      { id: 3, name: "Airport Parking", lat: 28.5721, lng: 77.1884, address: "Near T3" },
      { id: 4, name: "Hospital Parking", lat: 28.6353, lng: 77.2245, address: "Medical District" },
      { id: 5, name: "Shopping Complex", lat: 28.6129, lng: 77.2295, address: "Commercial Hub" },
      { id: 6, name: "Tech Park Parking", lat: 28.5941, lng: 77.1521, address: "IT Corridor" },
      { id: 7, name: "University Parking", lat: 28.6355, lng: 77.1994, address: "Educational Zone" },
      { id: 8, name: "Railway Station", lat: 28.5920, lng: 77.2414, address: "Transport Hub" },
      { id: 9, name: "Business District", lat: 28.6047, lng: 77.1827, address: "Corporate Area" },
      { id: 10, name: "Entertainment Zone", lat: 28.6335, lng: 77.2197, address: "Night Life Area" },
    ];

    if (dbConnected) {
      const slots = await Slot.find();
      const locationsWithAvailability = locations.map((loc) => ({
        ...loc,
        available: slots.filter((s) => s.id === loc.id && !s.booked).length > 0,
      }));
      res.json(locationsWithAvailability);
    } else {
      const locationsWithAvailability = locations.map((loc) => ({
        ...loc,
        available: memoryDB.slots.find((s) => s.id === loc.id)?.booked === false,
      }));
      res.json(locationsWithAvailability);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// ============ PAYMENT ROUTES ============

// Process payment (for Payment page)
app.post("/api/payment", verifyToken, async (req, res) => {
  try {
    const { slotNumber, duration, amount, email, cardDetails } = req.body;

    if (dbConnected) {
      // Check slot availability
      const slot = await Slot.findOne({ id: slotNumber });
      if (!slot || slot.booked) {
        return res.status(400).json({ error: "Slot not available" });
      }

      // Create booking
      const user = await User.findById(req.userId);
      const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);

      const booking = new BookingHistory({
        userId: req.userId,
        slot: slotNumber,
        registrationNumber: user?.registrationNumber || "N/A",
        hours: duration,
        amount: amount,
        paymentStatus: "completed",
        endTime,
      });

      await booking.save();

      // Update slot
      slot.booked = true;
      slot.endTime = endTime;
      slot.registrationNumber = user?.registrationNumber || "N/A";
      slot.userId = req.userId;
      await slot.save();

      res.json({
        success: true,
        bookingId: booking._id,
        message: "Payment successful",
      });
    } else {
      // In-memory fallback
      const slot = memoryDB.slots.find((s) => s.id === slotNumber);
      if (!slot || slot.booked) {
        return res.status(400).json({ error: "Slot not available" });
      }

      const user = memoryDB.users.find((u) => u.email === email);
      const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);
      const bookingId = `booking_${Date.now()}`;

      const booking = {
        _id: bookingId,
        userId: user?._id,
        slot: slotNumber,
        registrationNumber: user?.vehicleRegistration || "N/A",
        hours: duration,
        amount: amount,
        paymentStatus: "completed",
        bookedTime: new Date(),
        endTime,
        status: "active",
      };

      memoryDB.bookingHistory.push(booking);

      slot.booked = true;
      slot.endTime = endTime;
      slot.registrationNumber = user?.vehicleRegistration || "N/A";
      slot.userId = user?._id;

      res.json({
        success: true,
        bookingId,
        message: "Payment successful",
      });
    }
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Payment processing failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚗 Smart Parking System - MERN Stack (Full)`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📦 MongoDB: ${MONGODB_URI}`);
  console.log(`🔐 JWT Auth: Enabled`);
  console.log(`💳 Stripe Payment: Enabled\n`);
});
