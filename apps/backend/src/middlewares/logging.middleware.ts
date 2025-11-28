import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Log all requests
  logger.info(`Incoming ${req.method} request to ${req.url}`);

  // Capture the original send method
  const originalSend = res.send;
  
  // Override send method to log responses
  res.send = function (body) {
    logger.info(`Response for ${req.method} ${req.url} - Status: ${res.statusCode}`);
    
    // If there's an error and we're in development, log it
    if (res.statusCode >= 400 && process.env.NODE_ENV === 'development') {
      logger.error('Response body:', body);
    }
    
    // Call the original send
    return originalSend.call(this, body);
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