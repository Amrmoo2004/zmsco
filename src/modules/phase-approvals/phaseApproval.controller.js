import { Router } from "express";
import * as phaseApprovalService from "./phaseApproval.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

router.get("/", auth, phaseApprovalService.getPhaseApprovals);
router.post("/", auth, permission("UPDATE_PROJECT"), phaseApprovalService.createPhaseApproval);
router.put("/:approvalId", auth, permission("UPDATE_PROJECT"), phaseApprovalService.processPhaseApproval);

export default router;
