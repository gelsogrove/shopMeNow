import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Log all requests
  logger.info(`Incoming ${req.method} request to ${req.url}`);

  // Flag to prevent duplicate logs
  let logged = false;

  const logResponse = () => {
    if (logged) return;
    logged = true;
    
    logger.info(`Response for ${req.method} ${req.url} - Status: ${res.statusCode}`);
    
    // If there's an error and we're in development, log it
    if (res.statusCode >= 400 && process.env.NODE_ENV === 'development') {
      logger.error(`Error response for ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  };

  // Capture the original send method
  const originalSend = res.send;
  
  // Override send method to log responses
  res.send = function (body) {
    logResponse();
    // Call the original send
    return originalSend.call(this, body);
  };

  // Capture the original json method
  const originalJson = res.json;
  
  // Override json method to log responses (this catches .status(401).json() calls)
  res.json = function (body) {
    logResponse();
    // Call the original json
    return originalJson.call(this, body);
  };

  // Log any errors
  const errorHandler = (err: any) => {
    logger.error('Request error:', {
      method: req.method,
      url: req.url,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };

  // Attach error handler
  res.on('error', errorHandler);

  next();
}; 