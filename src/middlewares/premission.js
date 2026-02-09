export const permission = (perm) => {
  return (req, res, next) => {
    const permissions = req.user.permissions;

    if (
      permissions.includes("*") ||
      permissions.includes(perm)
    ) {
      return next();
    }

    return res.status(403).json({
      message: "Permission denied"
    });
  };
};
