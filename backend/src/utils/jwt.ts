import jwt from "jsonwebtoken";
import { env } from "../env";
import type { Role } from "@prisma/client";

// What we embed inside the signed token. orgId is included so every request
// is already scoped to the right organization without another DB lookup.
export interface AuthTokenPayload {
  userId: string;
  orgId: string;
  role: Role;
}

export function signToken(payload: AuthTokenPayload): string {
  // Cast keeps us compatible with @types/jsonwebtoken's strict `expiresIn` union
  // while still accepting a human-friendly string like "7d" from env.
  const options = { expiresIn: env.jwtExpiresIn } as jwt.SignOptions;
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
