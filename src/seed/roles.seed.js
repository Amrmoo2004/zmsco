import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../db/models/roles.js";
import { PERMISSIONS } from "../config/permissions.js";


dotenv.config();
await mongoose.connect(process.env.URL_DATABASE);

await Role.updateMany({}, { isDefault: false });

const roles = [
  {
    name: "ADMIN",
    permissions: ["*"],
    isDefault: false,
    isActive: true
  },
  {
    name: "PROJECT_MANAGER",
    permissions: [
      PERMISSIONS.CREATE_PROJECT,
      PERMISSIONS.EDIT_PROJECT,
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_PROJECT_COST,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL,
      PERMISSIONS.APPROVE_MATERIAL,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.DELETE_PROJECT
    ],
    isDefault: false,
    isActive: true
  },
  {
    name: "ACCOUNTANT",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_PROJECT_COST,
      PERMISSIONS.VIEW_REPORTS
    ],
    isDefault: false,
    isActive: true
  },
  {
    name: "SITE_ENGINEER",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL
    ],
    isDefault: false,
    isActive: true
  },
  {
    name: "STORE_KEEPER",
    permissions: [
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.APPROVE_MATERIAL,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.CREATE_RFQ,
      PERMISSIONS.RECEIVE_GOODS
    ],
    isDefault: false,
    isActive: true
  },
  {
    name: "USER",
    permissions: [
      PERMISSIONS.VIEW_PROJECT,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.REQUEST_MATERIAL
    ],
    isDefault: true,
    isActive: true
  }
];

// 👇 Upsert
for (const role of roles) {
  await Role.updateOne(
    { name: role.name },
    { $set: role },
    { upsert: true }
  );
}

console.log("✅ Roles seeded successfully");
process.exit();
