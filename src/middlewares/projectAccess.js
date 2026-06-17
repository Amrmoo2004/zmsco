import ProjectMember from "../db/models/projects/project.member.js";
import ProjectPhase from "../db/models/projects/project.phase.js";
import ProjectModel from "../db/models/projects/project.js";
import { AppError } from "../utils/appError.js";

/**
 * projectAccess(level)
 *
 * Middleware للتحقق من صلاحية المستخدم على مشروع معين.
 * يمر تلقائياً بدون permission عامة لو:
 *   1. عنده global permission زي ADMIN أو EDIT_PROJECT
 *   2. هو مدير المشروع
 *   3. هو عضو في المشروع (ProjectMember)
 *   4. (لـ "member" level) عنده task مسندة إليه في المشروع
 *
 * الـ projectId بييجي من: req.params.id أو req.params.projectId
 *
 * Usage:
 *   router.get("/:id", auth, projectAccess("view"), service.get_project)
 *   router.put("/:id", auth, projectAccess("edit"), service.update_project)
 *
 * Levels:
 *   "view"   → admin | manager | member | task-assignee
 *   "edit"   → admin | manager | member (not just assignee)
 *   "manage" → admin | manager only
 */
export const projectAccess = (level = "view") => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const permissions = req.user.permissions || [];

      // ── 1. Global Admin / wildcard → always pass ──────────────────────────
      if (permissions.includes("*")) return next();

      const projectId = req.params.id || req.params.projectId;

      // ── 2. No project ID in route → fall back to global permission check ──
      if (!projectId) {
        if (permissions.includes("EDIT_PROJECT") || permissions.includes("VIEW_PROJECT")) {
          return next();
        }
        return next(new AppError("Permission denied", 403));
      }

      // ── 3. Load project (lean for speed) ─────────────────────────────────
      const project = await ProjectModel.findById(projectId).select("manager").lean();
      if (!project) return next(new AppError("Project not found", 404));

      // ── 4. Project Manager → always pass ─────────────────────────────────
      const isManager = project.manager?.toString() === userId.toString();
      if (isManager) return next();

      // ── 5. "manage" level → manager only (already handled above) ─────────
      if (level === "manage") {
        return next(new AppError("Permission denied: project managers only", 403));
      }

      // ── 6. Project Member → pass for "view" and "edit" ───────────────────
      const isMember = await ProjectMember.exists({ project: projectId, user: userId });
      if (isMember) return next();

      // ── 7. Task Assignee → pass for "view" only ───────────────────────────
      if (level === "view") {
        const hasTask = await ProjectPhase.exists({
          project: projectId,
          "tasks.assignedTo": userId
        });
        if (hasTask) return next();
      }

      // ── 8. Fallback: check global permissions ─────────────────────────────
      if (level === "view" && permissions.includes("VIEW_PROJECT")) return next();
      if (level === "edit" && permissions.includes("EDIT_PROJECT")) return next();

      return next(new AppError("Permission denied: you are not a member of this project", 403));

    } catch (err) {
      return next(new AppError("Error checking project access", 500));
    }
  };
};
