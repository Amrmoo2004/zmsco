export const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = null;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
  }

  // Handle Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path || 'ID'}`;
    errors = [{ field: err.path, message: `Value '${err.value}' is not a valid ID` }];
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    if (err.keyValue && typeof err.keyValue === 'object') {
      const field = Object.keys(err.keyValue)[0];
      message = `Duplicate value error for field: ${field}`;
      errors = [{ field, message: `The value '${err.keyValue[field]}' already exists` }];
    } else {
      message = "Duplicate value error";
      errors = [{ field: 'unknown', message: 'A duplicate key error occurred' }];
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
