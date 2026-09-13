import type { NextFunction, Request, Response } from "express";
import { verifyToken, type AuthTokenPayload } from "../utils/jwt";
import { HttpError } from "./error";
import { prisma } from "../prisma";
import type { Role } from "@prisma/client";

// Make req.auth available to route handlers (TypeScript augmentation).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

// Verifies the Bearer token and re-checks the user still exists and is active
// on every request, so deactivating a user takes effect immediately.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyToken(header.slice("Bearer ".length));
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true },
  });
  if (!user) throw new HttpError(401, "Invalid or expired token");
  if (!user.isActive) throw new HttpError(403, "Your account is deactivated. Contact an admin.");

  // The token names an active company; confirm the user still has access to it and pick up
  // their current role there (so a role change or removal takes effect immediately).
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: payload.userId, orgId: payload.orgId } },
    select: { isActive: true, role: true, organization: { select: { isActive: true } } },
  });
  if (!membership || !membership.isActive) {
    throw new HttpError(403, "You don't have access to this company.");
  }
  // A platform-suspended company blocks all of its members.
  if (!membership.organization.isActive) {
    throw new HttpError(403, "This company has been suspended. Please contact support.");
  }

  req.auth = { ...payload, role: membership.role };
  next();
}

// Restricts a route to platform super-admins (the FinBooks owner). Unlike requireAuth this
// does NOT require org membership, because super-admin operates ACROSS all tenants. It's the
// only path that can bypass tenant isolation, so it's deliberately strict and self-contained.
export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyToken(header.slice("Bearer ".length));
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true, isSuperAdmin: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "Invalid or expired token");
  if (!user.isSuperAdmin) throw new HttpError(403, "Super-admin access required.");

  req.auth = payload;
  next();
}

// Restricts a route to one or more roles. Example: requireRole("ADMIN", "ACCOUNTANT").
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new HttpError(403, `Requires one of roles: ${roles.join(", ")}`);
    }
    next();
  };
}
