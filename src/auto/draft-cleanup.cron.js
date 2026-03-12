import cron from "node-cron";
import ProjectModel from "../db/models/projects/project.js";
import ProjectPhase from "../db/models/projects/project.phase.js";
import ProjectMember from "../db/models/projects/project.member.js";
import ProjectDocument from "../db/models/projects/project.document.js";
import ProjectEquipment from "../db/models/projects/project.equipment.js";
import ProjectMaterial from "../db/models/metrials/📁 projectMaterial.model.js";

const DRAFT_EXPIRY_HOURS = 48;

/**
 * Cleanup job: Runs every day at 2:00 AM
 * Deletes DRAFT projects older than 48 hours along with all related data
 */
export const startDraftCleanupJob = () => {
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("[CRON] Running draft project cleanup...");

      const cutoff = new Date(Date.now() - DRAFT_EXPIRY_HOURS * 60 * 60 * 1000);

      // Find expired DRAFT projects
      const expiredDrafts = await ProjectModel.find({
        status: "DRAFT",
        createdAt: { $lt: cutoff }
      }).select("_id");

      if (expiredDrafts.length === 0) {
        console.log("[CRON] No expired drafts found.");
        return;
      }

      const expiredIds = expiredDrafts.map((p) => p._id);

      // Delete all related data in parallel
      await Promise.all([
        ProjectPhase.deleteMany({ project: { $in: expiredIds } }),
        ProjectMember.deleteMany({ project: { $in: expiredIds } }),
        ProjectDocument.deleteMany({ project: { $in: expiredIds } }),
        ProjectEquipment.deleteMany({ project: { $in: expiredIds } }),
        ProjectMaterial.deleteMany({ project: { $in: expiredIds } }),
      ]);

      // Delete the projects themselves
      const result = await ProjectModel.deleteMany({ _id: { $in: expiredIds } });

      console.log(`[CRON] Cleaned up ${result.deletedCount} expired DRAFT project(s).`);
    } catch (err) {
      console.error("[CRON] Error during draft cleanup:", err.message);
    }
  });

  console.log("[CRON] Draft cleanup job scheduled (runs daily at 2:00 AM).");
};
