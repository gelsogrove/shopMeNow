import { Response } from 'express';
import logger from './logger';

/**
 * Utility class for API responses
 */
export class AppResponse {
  /**
   * Send a success response
   * @param res Express response object
   * @param data Data to include in response
   * @param statusCode HTTP status code (default: 200)
   */
  static success(res: Response, data: any = {}, statusCode = 200): void {
    res.status(statusCode).json(data);
  }

  /**
   * Send an error response
   * @param res Express response object
   * @param message Error message
   * @param statusCode HTTP status code
   * @param details Additional error details
   */
  static error(res: Response, message: string, statusCode = 500, details?: any): void {
    const response = {
      success: false,
      message,
      ...(details ? { details } : {})
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Send a bad request (400) response
   * @param res Express response object
   * @param message Error message
   */
  static badRequest(res: Response, message: string): void {
    this.error(res, message, 400);
  }

  /**
   * Send an unauthorized (401) response
   * @param res Express response object
   * @param message Error message
   */
  static unauthorized(res: Response, message = 'Unauthorized'): void {
    this.error(res, message, 401);
  }

  /**
   * Send a forbidden (403) response
   * @param res Express response object
   * @param message Error message
   */
  static forbidden(res: Response, message = 'Forbidden'): void {
    this.error(res, message, 403);
  }

  /**
   * Send a not found (404) response
   * @param res Express response object
   * @param message Error message
   */
  static notFound(res: Response, message = 'Resource not found'): void {
    this.error(res, message, 404);
  }

  /**
   * Send a server error (500) response
   * @param res Express response object
   * @param message Error message
   * @param error Original error for logging
   */
  static serverError(res: Response, message = 'Internal Server Error', error?: Error): void {
    if (error) {
      logger.error(message, error);
    }
    this.error(res, message, 500);
  }
} 