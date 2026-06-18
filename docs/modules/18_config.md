# Module 18 — Config

## Overview

The Config module holds all external system connection setup: MongoDB database connection and AWS S3 media storage configuration. Both are consumed by other modules at startup.

---

## Primary Files

| File | Role |
|------|------|
| `server/config/db.js` | MongoDB connection via Mongoose |
| `server/config/s3.js` | AWS S3 SDK configuration for file uploads |

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

## s3.js — File Storage Configuration

### Responsibility
- Configure the AWS S3 SDK using credentials from environment variables
- Export S3 helpers for uploads and short-lived pre-signed document URLs

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | S3 bucket region |
| `AWS_ACCESS_KEY_ID` | IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_S3_UPLOAD_PREFIX` | Optional folder-style key prefix |
| `AWS_S3_PUBLIC_URL` | Optional CloudFront or custom public base URL |

---

## Consumers

| Consumer | Uses |
|---------|------|
| `server.js` | Calls `connectDB()` before `app.listen()` |
| `server/middleware/uploadMiddleware.js` | Imports S3 helpers to upload files to S3 |
| `server/controllers/fileController.js` | Imports S3 helpers to issue pre-signed read URLs |

---

## Upload Behavior

Files are uploaded below the configured S3 prefix, defaulting to `filing-buddy`.  
The 10 MB file size limit is enforced at the multer layer in `uploadMiddleware.js`.
S3 objects should remain private; document display uses authenticated API calls
that return short-lived pre-signed URLs.
