export const permission = (perm) => {
  return (req, res, next) => {
    try {
      // User's global permissions (loaded during login/auth token verification)
      const systemPermissions = req.user.permissions || [];

      // If user is Admin (*) or has the specific permission
      if (systemPermissions.includes("*") || systemPermissions.includes(perm)) {
        return next();
      }

      // Deny access
      return res.status(403).json({
        success: false,
        message: "Permission denied: You do not have the required access level for this action."
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error verifying permissions",
        error: error.message
      });
    }
  };
};


