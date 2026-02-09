import express from "express";
import * as service from "./metrials.services.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

router.post(
  "/",
  auth,
  permission("REQUEST_MATERIAL"),
  async (req, res) => {
    const data = await service.create_request({
      project: req.body.project,
      items: req.body.items,
      userId: req.user.id
    });

    res.status(201).json({ success: true, data });
  }
);

router.patch(
  "/:id/approve",
  auth,
  permission("APPROVE_MATERIAL"),
  async (req, res) => {
    const data = await service.approve_request(req.params.id, req.user.id);
    res.json({ success: true, data });
  }
);

router.patch(
  "/:id/issue",
  auth,
  permission("ISSUE_MATERIAL"),
  async (req, res) => {
    const data = await service.issue_request(req.params.id, req.user.id);
    res.json({ success: true, data });
  }
);

export default router;
