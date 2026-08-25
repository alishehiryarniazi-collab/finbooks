import type { NextFunction, Request, Response } from "express";

// A thrown HttpError carries an HTTP status so route handlers can signal
// "this is a client/known error, respond with this code" instead of a generic 500.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Unknown/unexpected error — log it server-side, hide details from the client.
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
