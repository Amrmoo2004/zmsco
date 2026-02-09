import ProjectModel from "../../db/models/projects/project.js";
import { asynchandler } from "../../utils/response/response.js";
import { autoSetupProject } from './../../auto/project-auto-setup.service.js';
import { AppError } from "../../utils/appError.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import User from "../../db/models/user.js";
import Warehouse from "../../db/models/warehouse.model.js";

/**
 * CREATE PROJECT
 */
export const create_project = asynchandler(async (req, res, next) => {
  const {
    name,
    type,
    priority,
    budget,
    startDate,
    endDate,
    manager,
    department,
    client,
    description,
    warehouseType // 'SHARED' or 'DEDICATED'
  } = req.body;

  if (!name || !type || !manager) {
    return next(new Error("Missing required fields", { cause: 400 }));
  }

  // auto project code
  const projectCode = `PR-${Date.now()}`;

  // 1. Create Project
  const project = await ProjectModel.create({
    name,
    code: projectCode,
    type,
    priority,
    budget,
    startDate,
    endDate,
    manager,
    department,
    client,
    description,
    warehouseType,
    createdBy: req.user.id
  });

  // 2. Handle Dedicated Warehouse
  if (warehouseType === "DEDICATED") {
    const warehouse = await Warehouse.create({
      name: `${project.name} Warehouse`,
      location: `Site: ${project.location || 'Project Site'}`,
      type: "PROJECT",
      project: project._id,
      manager: manager
    });

    project.dedicatedWarehouse = warehouse._id;
    await project.save();
  }

  await autoSetupProject(project);

  return res.status(201).json({
    success: true,
    message: "Project created successfully",
    data: project
  });

  /**
   * GET ALL PROJECTS
   */
});
  export const get_projects = asynchandler(async (req, res, next) => {
    const projects = await ProjectModel.find({ isActive: true })
      .populate("manager", "username email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: projects
    });
  });

  /**
   * GET SINGLE PROJECT
   */
  export const get_project = asynchandler(async (req, res, next) => {
    const project = await ProjectModel.findById(req.params.id)
      .populate("manager", "username email");

    if (!project) {
      return next(new Error("Project not found", { cause: 404 }));
    }

    const members = await ProjectMember.find({ project: req.params.id })
      .populate("assignedUser", "name email"); // Optional: populate assigned user details

    return res.status(200).json({
      success: true,
      data: { ...project.toObject(), members }
    });
  });

  /**
   * UPDATE PROJECT
   */
  export const update_project = asynchandler(async (req, res, next) => {
    const project = await ProjectModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!project) {
      return next(new Error("Project not found", { cause: 404 }));
    }

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project
    });
  });

  /**
   * DELETE PROJECT (soft delete)
   */
  export const delete_project = asynchandler(async (req, res, next) => {
    const project = await ProjectModel.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!project) {
      return next(new Error("Project not found", { cause: 404 }));
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully"
    });

  });

  /**
   * ASSIGN MEMBER TO PROJECT
   */
  export const assign_member = asynchandler(async (req, res, next) => {
    const { id: projectId, memberId } = req.params;
    const { userId } = req.body;

    // 1. تأكد إن اليوزر موجود
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // 2. تأكد إن الـ vacancy تبع المشروع
    const memberSlot = await ProjectMember.findOne({
      _id: memberId,
      project: projectId,
      status: "VACANT"
    });

    if (!memberSlot) {
      return next(new AppError("Member vacancy not found or already filled", 404));
    }

    // 3. assign
    memberSlot.assignedUser = userId;
    memberSlot.status = "FILLED";
    await memberSlot.save();

    // 4. Update User Role (If vacancy has a systemRole)
    if (memberSlot.systemRole) {
      await User.findByIdAndUpdate(
        userId,
        { role: memberSlot.systemRole },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Member assigned successfully",
      data: memberSlot
    });
  });
