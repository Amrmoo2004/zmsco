import express from 'express';
import cors from "cors";
import morgan from 'morgan';
import swaggerUi from "swagger-ui-express";
import cookieParser from 'cookie-parser';
import swaggerSpec from "./docs/swagger.js";
import { connectDB } from "./db/db.connection.js";
import authRoutes from "./modules/auth/auth.controller.js";
import userRoutes from "./modules/users/user.controller.js";
import projectRoutes from "./modules/projects/project.controller.js";
import stockRoutes from "./modules/stock/stock.controller.js";
import procurementRoutes from "./modules/procurement/procurement.controller.js";
import { globalErrorHandler } from "./middlewares/error.js";
import dashboardRoutes from "./modules/dashboard/dashboard.controller.js";
import materialRoutes from "./modules/materials/material.controller.js";
import materialRequestRoutes from "./modules/material-requests/material-request.controller.js";
import materialTransactionRoutes from "./modules/material-transactions/material-transaction.controller.js";
import warehouseRoutes from "./modules/warehouses/warehouse.controller.js";
import supplierRoutes from "./modules/suppliers/supplier.controller.js";
import projectMemberRoutes from "./modules/project-members/project-member.controller.js";
import projectPhaseRoutes from "./modules/project-phases/project-phase.controller.js";
import projectDocumentRoutes from "./modules/project-documents/project-document.controller.js";
import projectEquipmentRoutes from "./modules/project-equipment/project-equipment.controller.js";
import projectTemplateRoutes from "./modules/project-templates/project-template.controller.js";
import roleRoutes from "./modules/roles/role.controller.js";
import notificationRoutes from "./modules/notifications/notification.controller.js";
import attachmentRoutes from "./modules/attachments/attachment.controller.js";

// Phase 1: Settings & HR Foundation
import departmentRoutes from "./modules/departments/department.controller.js";
import jobTitleRoutes from "./modules/job-titles/jobTitle.controller.js";
import systemConfigRoutes from "./modules/system-configuration/systemConfig.controller.js";
import workflowRoutes from "./modules/workflows/workflow.controller.js";
import projectTypeRoutes from "./modules/project-types/projectType.controller.js";

// Phase 2: Project Core Upgrades
import taskRoutes from "./modules/tasks/task.controller.js";
import phaseApprovalRoutes from "./modules/phase-approvals/phaseApproval.controller.js";

// Phase 3: HR, Equipment & Resources
import hrRoutes from "./modules/hr/hr.controller.js";
import equipmentRoutes from "./modules/equipment/equipment.controller.js";

// Phase 4: Procurement & Inventory
import quoteRoutes from "./modules/quotes/quote.controller.js";
import goodsReceiptRoutes from "./modules/goods-receipts/goodsReceipt.controller.js";

// Phase 5: Ticketing & Project Closure
import ticketRoutes from "./modules/tickets/ticket.controller.js";
import projectClosureRoutes from "./modules/project-closure/projectClosure.controller.js";


const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.use(cookieParser());

export const bootstrap = async () => {
  app.get('/', (req, res) => {
    res.send('API is working!');
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/procurement', procurementRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Material Management APIs
  app.use('/api/materials', materialRoutes);
  app.use('/api/material-requests', materialRequestRoutes);
  app.use('/api/material-transactions', materialTransactionRoutes);

  // Warehouse Management APIs
  app.use('/api/warehouses', warehouseRoutes);

  // Procurement Enhancement APIs
  app.use('/api/suppliers', supplierRoutes);

  // Project Enhancement APIs
  app.use('/api/projects', projectMemberRoutes);
  app.use('/api/projects', projectPhaseRoutes);
  app.use('/api/projects', projectDocumentRoutes);
  app.use('/api/projects', projectEquipmentRoutes);
  app.use('/api/project-templates', projectTemplateRoutes);

  // Roles & Permissions APIs
  app.use('/api/roles', roleRoutes);

  // Real-time Notifications API
  app.use('/api/notifications', notificationRoutes);

  // File Upload API (Cloudinary)
  app.use('/api/upload', attachmentRoutes);

  // Phase 1: Settings & Foundation APIs
  app.use('/api/departments', departmentRoutes);
  app.use('/api/job-titles', jobTitleRoutes);
  app.use('/api/system-config', systemConfigRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/project-types', projectTypeRoutes);

  // Phase 2: Project Core Upgrades
  app.use('/api/projects/:projectId/phases/:phaseId/tasks', taskRoutes);
  app.use('/api/projects/:projectId/phases/:phaseId/approvals', phaseApprovalRoutes);

  // Phase 3: HR, Equipment & Resources APIs
  app.use('/api/hr', hrRoutes);
  app.use('/api/equipment', equipmentRoutes);

  // Phase 4: Procurement & Inventory APIs
  app.use('/api/rfqs/:rfqId/quotes', quoteRoutes);
  app.use('/api/purchase-orders/:poId/receipts', goodsReceiptRoutes);

  // Phase 5: Ticketing & Project Closure APIs
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/projects/:projectId/closure', projectClosureRoutes);

  app.use(globalErrorHandler);


  await connectDB();

  // Return the app so index.js can attach Socket.IO and start the HTTP server
  return app;
};
