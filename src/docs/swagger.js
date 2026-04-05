
import swaggerJSDoc from "swagger-jsdoc";
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sewer Projects Management API",
      version: "1.0.0",
      description: "System for managing sewer infrastructure projects"
    },
   servers: [
      {
        url: "http://localhost:3000/api",
        description: "Local Development Server"
      },
      {
          url: "http://100.53.112.217:3000/api",
        description: "AWS EC2 Server"
      },
      {
        url: "https://zmsco.onrender.com/api",
        description: "Render Server"
      }
    ],
    tags: [
      { name: "Auth", description: "Authentication & Authorization" },
      { name: "Users", description: "User Management" },
      { name: "Settings", description: "⚙️ System Settings — all configurable modules and management pages" },
      { name: "Projects", description: "Project Lifecycle Management" },
      { name: "Project Phases", description: "Phase Management within Projects" },
      { name: "Phase Tasks", description: "Tasks & Gating within Phases" },
      { name: "Phase Approvals", description: "Phase Approval Workflow" },
      { name: "Project Members", description: "Project Team Management" },
      { name: "Project Documents", description: "Project Document Management" },
      { name: "Project Equipment", description: "Equipment Assigned to Projects" },
      { name: "Project Closure", description: "Project Closure Process & Certificates" },
      { name: "HR", description: "Human Resources — Work Logs & HR Requests" },
      { name: "Equipment", description: "Equipment Fleet & Maintenance" },
      { name: "Materials", description: "Material Catalog Management" },
      { name: "Material Requests", description: "Material Request Workflow" },
      { name: "Material Transactions", description: "Material Movement Tracking" },
      { name: "Stock", description: "Inventory & Stock Management" },
      { name: "Warehouses", description: "Warehouse Management" },
      { name: "Suppliers", description: "Supplier Management" },
      { name: "Procurement", description: "RFQ, Purchase Orders & Goods Receipts" },
      { name: "Quotes", description: "Supplier Quotes per RFQ" },
      { name: "Goods Receipts", description: "Goods Receipt Notes per PO" },
      { name: "Tickets", description: "Maintenance & Support Tickets" },
      { name: "Notifications", description: "Real-time Notification Management" },
      { name: "Attachments", description: "File Upload Management (Cloudinary)" },
      { name: "Dashboard", description: "Dashboard Analytics & Statistics" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },

  apis: ["./src/modules/**/*.js"]
};

// Generate base spec
const spec = swaggerJSDoc(options);

// ── Auto-inject "Settings" tag for Settings-page APIs only ──────────────────
// These are the APIs that correspond to pages inside the Settings sidebar:
// الإعدادات العامة, إعدادات المشاريع, المستخدمين والصلاحيات,
// المخزون والمواد, المشتريات, الموظفين والموارد,
// سير العمل والموافقات, الإشعارات, التقارير والقوالب, الأمان والمراجعة
const SETTINGS_PATH_PREFIXES = [
  "/users",
  "/roles",
  "/departments",
  "/job-titles",
  "/system-config",
  "/workflows",
  "/project-types",
  "/materials",
  "/warehouses",
  "/suppliers",
  "/procurement",
  "/hr",
  "/equipment",
  "/notifications",
  "/audit-logs",
  "/report-templates"
];

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

if (spec.paths) {
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    const isSettingsPath = SETTINGS_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
    if (isSettingsPath) {
      HTTP_METHODS.forEach(method => {
        const operation = pathItem[method];
        if (operation && Array.isArray(operation.tags) && !operation.tags.includes("Settings")) {
          operation.tags = ["Settings", ...operation.tags];
        }
      });
    }
  });
}
// ────────────────────────────────────────────────────────────────────────────

export default spec;


