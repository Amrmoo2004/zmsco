export const PERMISSIONS = {
  // ─── Users ─────────────────────────────────────────────────────────────────
  VIEW_USERS:       "VIEW_USERS",
  EDIT_USER:        "EDIT_USER",
  DELETE_USER:      "DELETE_USER",
  ASSIGN_ROLE:      "ASSIGN_ROLE",

  // ─── Roles ─────────────────────────────────────────────────────────────────
  MANAGE_ROLES:     "MANAGE_ROLES",   // create / update / delete roles

  // ─── Projects ──────────────────────────────────────────────────────────────
  VIEW_PROJECT:     "VIEW_PROJECT",
  CREATE_PROJECT:   "CREATE_PROJECT",
  EDIT_PROJECT:     "EDIT_PROJECT",
  DELETE_PROJECT:   "DELETE_PROJECT",
  VIEW_PROJECT_COST:"VIEW_PROJECT_COST",

  // ─── Inventory / Materials ─────────────────────────────────────────────────
  VIEW_INVENTORY:   "VIEW_INVENTORY",
  MANAGE_INVENTORY: "MANAGE_INVENTORY", // create / update / delete materials & warehouses
  REQUEST_MATERIAL: "REQUEST_MATERIAL",
  APPROVE_MATERIAL: "APPROVE_MATERIAL",

  // ─── Suppliers ─────────────────────────────────────────────────────────────
  VIEW_SUPPLIERS:   "VIEW_SUPPLIERS",
  MANAGE_SUPPLIERS: "MANAGE_SUPPLIERS", // create / update / delete suppliers

  // ─── Procurement ───────────────────────────────────────────────────────────
  CREATE_RFQ:       "CREATE_RFQ",
  CREATE_PO:        "CREATE_PO",
  RECEIVE_GOODS:    "RECEIVE_GOODS",

  // ─── Reports ───────────────────────────────────────────────────────────────
  VIEW_REPORTS:     "VIEW_REPORTS",

  // ─── System Settings ───────────────────────────────────────────────────────
  MANAGE_SETTINGS:  "MANAGE_SETTINGS", // system config / workflows / templates

  // ─── HR ────────────────────────────────────────────────────────────────────────
  MANAGE_HR:        "MANAGE_HR",       // job titles, hr requests processing

  // ─── Equipment ─────────────────────────────────────────────────────────────────
  MANAGE_EQUIPMENT: "MANAGE_EQUIPMENT", // create / update / delete / assign equipment
};
