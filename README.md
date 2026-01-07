# Smart Parking System - Backend (MERN Stack)

A Node.js/Express backend server with MongoDB for managing parking slots, bookings, and revenue tracking.

## Features

✅ Real-time slot management with MongoDB
✅ Automatic booking expiration
✅ Booking history tracking
✅ Revenue calculation
✅ Admin reset functionality
✅ RESTful API endpoints
✅ Mongoose ODM for database operations

## Prerequisites

- Node.js 14+
- MongoDB (Local or Atlas Cloud)

## Installation

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create .env file:**
```
MONGODB_URI=mongodb://localhost:27017/smart-parking
PORT=5000
NODE_ENV=development
```

For MongoDB Atlas (Cloud):
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-parking
```

## Running the Server

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### 1. Get All Slots
```
GET /api/slots
Response: { slots: [], available: 0, booked: 0, total: 10 }
```

### 2. Book a Slot
```
POST /api/slots/book
Body: {
  slotId: 1,
  hours: 1,
  registrationNumber: "DL 01 AB 1234"
}
Response: { success: true, message: "...", booking: {...} }
```

### 3. Get Available Slots Count
```
GET /api/slots/available/count
Response: { available: 7, total: 10 }
```

### 4. Cancel Booking
```
POST /api/slots/cancel/:slotId
Response: { success: true, message: "Booking cancelled" }
```

### 5. Get Booking History
```
GET /api/history
Response: [{ id: 1, slot: 1, registrationNumber: "...", hours: 1, amount: 50, ... }]
```

### 6. Get Slot Details
```
GET /api/slots/:id
Response: { id: 1, booked: false, endTime: null, registrationNumber: null }
```

### 7. Reset All Slots (Admin)
```
POST /api/admin/reset
Response: { success: true, message: "All slots reset" }
```

## Data Structure

### Slot Object
```javascript
{
  id: 1,
  booked: false,
  endTime: null,
  registrationNumber: null
}
```

### Booking History Object
```javascript
{
  id: 1,
  slot: 1,
  registrationNumber: "DL 01 AB 1234",
  hours: 1,
  amount: 50,
  bookedTime: "1/4/2026, 10:30:45 AM",
  endTime: "1/4/2026, 11:30:45 AM"
}
```

## Pricing

- 1 Hour: ₹50
- 2 Hours: ₹100
- 3 Hours: ₹150

## Notes

- Slots automatically expire when the booking time ends
- The server runs a cleanup interval every 1 second
- All data is stored in memory (resets when server restarts)
- For production, consider using a database like MongoDB or PostgreSQL

## Environment

- Node.js 14+
- npm or yarn
