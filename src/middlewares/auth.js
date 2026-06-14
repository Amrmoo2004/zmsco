import { verifyToken } from "../utils/token.js";
import Role from "../db/models/roles.js";
import BlacklistToken from "../db/models/blacklist.model.js";
import { AppError } from "../utils/appError.js";
import { blacklistCache, roleCache } from "../utils/cache.js";

// Cache TTLs
const BLACKLIST_TTL = 2 * 60 * 1000;   // 2 minutes
const ROLE_TTL = 10 * 60 * 1000;       // 10 minutes (roles change rarely)

export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return next(new AppError("Unauthorized", 401));
    }

    const token = header.split(" ")[1];

    // ── Blacklist check (cached) ──────────────────────────────────────────────
    // Check in-memory cache first to avoid DB hit on every request
    const cachedBlacklist = blacklistCache.get(`bl:${token}`);
    if (cachedBlacklist === true) {
      return next(new AppError("Token invalid or expired", 401));
    }

    // Only query DB if cache miss
    if (cachedBlacklist === undefined) {
      const isBlacklisted = await BlacklistToken.exists({ token });
      // Cache the result (whether blacklisted or not)
      blacklistCache.set(`bl:${token}`, !!isBlacklisted, BLACKLIST_TTL);
      if (isBlacklisted) {
        return next(new AppError("Token invalid or expired", 401));
      }
    }

    const decoded = verifyToken(token);

    // ── Role lookup (cached) ──────────────────────────────────────────────────
    // Roles rarely change — cache them to avoid DB query on every request
    const roleKey = `role:${decoded.roleId}`;
    let role = roleCache.get(roleKey);

    if (!role) {
      role = await Role.findById(decoded.roleId).lean();
      if (role) {
        roleCache.set(roleKey, role, ROLE_TTL);
      }
    }

    if (!role) {
      return next(new AppError("Role not found", 403));
    }

    req.user = {
      _id: decoded.userId,  
      id: decoded.userId,
      role: role.name,
      permissions: role.permissions
    };

    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token", 401));
  }
};

/**
 * Call this when a role is updated to invalidate the cached version.
 * @param {string} roleId
 */
export const invalidateRoleCache = (roleId) => {
  roleCache.del(`role:${roleId}`);
};