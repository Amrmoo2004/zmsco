import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../db/models/roles.js";
import { PERMISSIONS } from "../config/permissions.js";

dotenv.config();
await mongoose.connect(process.env.URL_DATABASE);

await Role.updateMany({}, { isDefault: false });

const roles = [
  // ─── Super Admin ───────────────────────────────────────────────────────────
  {
    name: "ADMIN",
    description: "صلاحيات كاملة على جميع أقسام النظام",
    permissions: ["*"],
    isDefault: false,
    isActive: true
  },

  // ─── مدير المشروع ──────────────────────────────────────────────────────────
  {
    name: "PROJECT_MANAGER",
    description: "صلاحيات كاملة لإدارة المشاريع",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.CREATE_PROJECT,
      PERMISSIONS.EDIT_PROJECT,
      PERMISSIONS.DELETE_PROJECT,
      PERMISSIONS.VIEW_PROJECT_COST,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL,
      PERMISSIONS.APPROVE_MATERIAL,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_SUPPLIERS,
      PERMISSIONS.CREATE_RFQ
    ],
    isDefault: false,
    isActive: true
  },

  // ─── مدير مالي ─────────────────────────────────────────────────────────────
  {
    name: "FINANCIAL_MANAGER",
    description: "إدارة الشؤون المالية والموافقات",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_PROJECT_COST,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.VIEW_SUPPLIERS,
      PERMISSIONS.CREATE_PO,
      PERMISSIONS.CREATE_RFQ,
      PERMISSIONS.APPROVE_MATERIAL
    ],
    isDefault: false,
    isActive: true
  },

  // ─── مدير مخزون ────────────────────────────────────────────────────────────
  {
    name: "WAREHOUSE_MANAGER",
    description: "إدارة المخازن والمواد",
    permissions: [
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.MANAGE_INVENTORY,
      PERMISSIONS.APPROVE_MATERIAL,
      PERMISSIONS.REQUEST_MATERIAL,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_SUPPLIERS,
      PERMISSIONS.CREATE_RFQ,
      PERMISSIONS.RECEIVE_GOODS
    ],
    isDefault: false,
    isActive: true
  },

  // ─── مهندس موقع ────────────────────────────────────────────────────────────
  {
    name: "SITE_ENGINEER",
    description: "متابعة تنفيذ المشروع وطلب المواد",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL
    ],
    isDefault: false,
    isActive: true
  },

  // ─── مستخدم افتراضي ────────────────────────────────────────────────────────
  {
    name: "USER",
    description: "مستخدم عادي بصلاحيات محدودة",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL
    ],
    isDefault: true,
    isActive: true
  }
];

// Upsert all roles
for (const role of roles) {
  await Role.updateOne(
    { name: role.name },
    { $set: role },
    { upsert: true }
  );
}

console.log("✅ Roles seeded successfully");
process.exit();
