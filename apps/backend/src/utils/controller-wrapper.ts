import { NextFunction, Request, RequestHandler, Response } from 'express';

export type ControllerFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any> | void;

/**
 * Wrapper per convertire una funzione controller in un RequestHandler
 * Evita di usare "as unknown as RequestHandler"
 */
export function wrapController(controllerFn: ControllerFunction): RequestHandler {
  return (req, res, next) => {
    return Promise.resolve(controllerFn(req, res, next)).catch(next);
  };
} 