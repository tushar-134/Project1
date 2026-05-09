# Filing Buddy

Filing Buddy is a full-stack practice management system for a UAE-based accounting firm. The project includes a React frontend and a Node.js/Express/MongoDB backend with JWT authentication, seeded sample data, notification polling, reporting, and task/client management workflows.

## Stack

- React + Vite
- Tailwind CSS
- React Router
- Axios
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Cloudinary uploads
- Nodemailer

## Project Structure

```text
project1/
  src/               Frontend application
  server/            Express API, models, controllers, seed script
  index.html         Vite entry
  package.json       Frontend scripts and dependencies
```

## Features

- JWT login and protected routes
- Dashboard with live stats and recent activity
- Add/list clients
- Bulk upload preview flow
- Add/list tasks with inline status updates
- FTA tracker
- Categories and task types management
- User management
- Client groups
- Reports
- Notification polling

## Local Setup

### 1. Frontend

```bash
npm install
```

Create the frontend env file from `.env.example`:

```bash
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

### 2. Backend

```bash
cd server
npm install
```

Create `server/.env` from `server/.env.example` and fill in:

- `MONGO_URI`
- `JWT_SECRET`
- Cloudinary credentials
- Email credentials

Start the backend:

```bash
npm run dev
```

## Seed Data

Run the backend seed script after MongoDB is configured:

```bash
cd server
npm run seed
```

Seeded login:

- `admin@filingbuddy.ae` / `Admin@123`
- `sara@filingbuddy.ae` / `Sara@123`
- `omar@filingbuddy.ae` / `Omar@123`

## Important Notes

- The repository ignores local `.env` files so secrets are not committed.
- Email sending is skipped automatically when placeholder SMTP credentials are present.
- The backend allows both `http://localhost:5173` and `http://127.0.0.1:5173` for local frontend access.

## Scripts

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

### Backend

```bash
cd server
npm run dev
npm run start
npm run seed
```
