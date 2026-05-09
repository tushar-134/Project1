function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.originalUrl}`));
}

function errorMiddleware(err, req, res, next) {
  // Controllers can throw normally; this handler is the single place that shapes API error responses.
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

module.exports = { notFound, errorMiddleware };
