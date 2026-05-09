const nodemailer = require("nodemailer");

function isPlaceholder(value = "") {
  const normalized = String(value).trim().toLowerCase();
  return !normalized || normalized.includes("your@") || normalized.includes("your_") || normalized.includes("your ") || normalized === "smtp.gmail.com" && !process.env.EMAIL_PASS;
}

async function sendEmail({ to, subject, text, html }) {
  // Local environments often run without SMTP credentials; callers should not crash when email is optional.
  if (
    isPlaceholder(process.env.EMAIL_HOST) ||
    isPlaceholder(process.env.EMAIL_USER) ||
    isPlaceholder(process.env.EMAIL_PASS)
  ) {
    return { skipped: true, reason: "email_credentials_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text, html });
}

module.exports = sendEmail;
