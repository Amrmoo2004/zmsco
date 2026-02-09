import { verifyToken } from "../utils/token.js";
import Role from "../db/models/roles.js";
import BlacklistToken from "../db/models/blacklist.model.js";
import { AppError } from "../utils/appError.js";
export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return next(new AppError("Unauthorized", 401));
    }

    const token = header.split(" ")[1];

    const isBlacklisted = await BlacklistToken.exists({ token });
    if (isBlacklisted) {
      return next(new AppError("Token invalid or expired", 401));
    }

    const decoded = verifyToken(token);

    const role = await Role.findById(decoded.roleId);

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