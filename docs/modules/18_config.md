# Module 18 — Config

## Overview

The Config module holds all external system connection setup: MongoDB database connection and Cloudinary media storage configuration. Both are consumed by other modules at startup.

---

## Primary Files

| File | Role |
|------|------|
| `server/config/db.js` | MongoDB connection via Mongoose |
| `server/config/cloudinary.js` | Cloudinary SDK configuration for file uploads |

---

## db.js — MongoDB Connection

### Responsibility
- Connect Mongoose to MongoDB using the `MONGO_URI` environment variable
- Export the async `connectDB()` function, which is called by `server.js` before the HTTP listener starts

### Behavior
- On success: logs the connected host
- On failure: throws the error, causing `server.js` to catch it and call `process.exit(1)`

This fail-fast behavior ensures the API never starts in a half-alive state when the database is unavailable.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | Full MongoDB connection string (Atlas or local) |

---

## cloudinary.js — File Storage Configuration

### Responsibility
- Configure the Cloudinary SDK using account credentials from environment variables
- Export the configured Cloudinary instance for use by `uploadMiddleware.js`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

---

## Consumers

| Consumer | Uses |
|---------|------|
| `server.js` | Calls `connectDB()` before `app.listen()` |
| `server/middleware/uploadMiddleware.js` | Imports Cloudinary to create `CloudinaryStorage` |

---

## Upload Behavior

Files are uploaded to the Cloudinary folder `filing-buddy` with `resource_type: "auto"`.  
The 10 MB file size limit is enforced at the multer layer in `uploadMiddleware.js`.
