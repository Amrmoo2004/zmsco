import { json } from "express";

export const asynchandler = (fn) => {
  return (req, res, next) => {
    // Ensure fn returns a Promise
    const fnReturn = fn(req, res, next);
    
    // Only call .catch if it's a Promise
    if (fnReturn && typeof fnReturn.catch === 'function') {
      return fnReturn.catch(next);
    }
    
    return fnReturn;
  };
};
export const globalErrorHandler = (error, req, res, next) => {
 return  res.status(error.cause||500).json({message: error.message});
};

export const successResponse = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({
        status: "success",
        message: "Request was successful",
        data: data  
    });
};