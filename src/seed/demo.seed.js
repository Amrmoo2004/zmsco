import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../db/models/roles.js";
import User from "../db/models/user.js";
import Project from "../db/models/projects/project.js";
import ProjectPhase from "../db/models/projects/project.phase.js";
import ProjectMember from "../db/models/projects/project.member.js";
import { Equipment, EquipmentAssignment, EquipmentMaintenance } from "../db/models/hr/equipment.model.js";
import HrRequest from "../db/models/hr/hrRequest.model.js";
import MaterialRequest from "../db/models/metrials/materialRequest.model.js";
import Material from "../db/models/metrials/metrials.js";
import Warehouse from "../db/models/warehouse.model.js";
import ProjectType from "../db/models/settings/projectType.model.js";
import MaterialCategory from "../db/models/settings/materialCategory.model.js";
import MeasurementUnit from "../db/models/settings/measurementUnit.model.js";
import JobTitle from "../db/models/settings/jobTitle.model.js";
import Ticket from "../db/models/tickets/ticket.model.js";
import Supplier from "../db/models/procurement/supplier.model.js";
import RFQ from "../db/models/procurement/rfq.model.js";

dotenv.config();
await mongoose.connect(process.env.URL_DATABASE);

console.log("🌱 Starting detailed demo seed...");

// --- 1. Clear some collections (optional but good for clean state) ---
await User.deleteMany({ email: { $ne: "admin@zmsco.com" } });
await Project.deleteMany();
await ProjectPhase.deleteMany();
await ProjectMember.deleteMany();
await Equipment.deleteMany();
await EquipmentAssignment.deleteMany();
await EquipmentMaintenance.deleteMany();
await HrRequest.deleteMany();
await MaterialRequest.deleteMany();
import Inventory from "../db/models/inventory.js";
await Inventory.deleteMany();
await Ticket.deleteMany();
await Supplier.deleteMany();
await RFQ.deleteMany();

import Department from "../db/models/settings/department.model.js";

// --- 2. Roles & Job Titles & Departments ---
const pmRole = await Role.findOne({ name: "PROJECT_MANAGER" });
const hrRole = await Role.findOne({ name: "ADMIN" }); // Fallback to admin for now
const userRole = await Role.findOne({ name: "USER" });
const siteEngRole = await Role.findOne({ name: "SITE_ENGINEER" });

const engineeringDept = await Department.findOneAndUpdate(
  { nameAr: "الإدارة الهندسية" },
  { nameEn: "Engineering Department", code: "ENG-001" },
  { upsert: true, new: true }
);

const engineerJob = await JobTitle.findOneAndUpdate(
  { nameAr: "مهندس موقع" },
  { nameEn: "Site Engineer", code: "JOB-ENG-001", department: engineeringDept._id },
  { upsert: true, new: true }
);
const laborerJob = await JobTitle.findOneAndUpdate(
  { nameAr: "عامل بناء" },
  { nameEn: "Construction Worker", code: "JOB-WRK-001", department: engineeringDept._id },
  { upsert: true, new: true }
);

// --- 3. Employees (Users) ---
const employees = [];
const empData = [
  { name: "أحمد محمود", email: "ahmed@zmsco.com", pass: "123456", role: siteEngRole?._id, job: engineerJob._id, status: "AVAILABLE" },
  { name: "خالد سعيد", email: "khaled@zmsco.com", pass: "123456", role: userRole?._id, job: laborerJob._id, status: "AVAILABLE" },
  { name: "يوسف النجار", email: "youssef@zmsco.com", pass: "123456", role: userRole?._id, job: laborerJob._id, status: "BUSY" },
  { name: "مروان طارق", email: "marwan@zmsco.com", pass: "123456", role: siteEngRole?._id, job: engineerJob._id, status: "ON_LEAVE" }
];

for (const e of empData) {
  const u = await User.create({
    name: e.name,
    email: e.email,
    password: e.pass, // normally hashed, but ok for fast seed
    role: e.role,
    jobTitle: e.job,
    status: e.status,
    joinDate: new Date("2023-01-15")
  });
  employees.push(u);
}
console.log(`✅ Seeded ${employees.length} employees.`);

// --- 4. Equipment ---
const equipments = [];
const eqData = [
  { name: "رافعة هيدروليكية 50 طن", type: "Crane", brand: "Caterpillar", model: "CT-500", dailyCost: 1500, condition: "EXCELLENT" },
  { name: "حفار مجنزر", type: "Excavator", brand: "Komatsu", model: "PC200", dailyCost: 900, condition: "GOOD" },
  { name: "خلاطة خرسانة متنقلة", type: "Mixer", brand: "Mercedes", model: "Arocs", dailyCost: 1200, condition: "UNDER_MAINTENANCE" }
];

for (const eq of eqData) {
  const q = await Equipment.create({ ...eq, purchaseDate: new Date("2022-05-10") });
  equipments.push(q);
  
  // History - Maintenance
  await EquipmentMaintenance.create({
    equipment: q._id,
    date: new Date("2025-01-10"),
    type: "PREVENTIVE",
    cost: 500,
    description: "تغيير زيوت وفلاتر الصيانة الدورية",
    performedBy: "ورشة الصيانة المركزية"
  });
}
console.log(`✅ Seeded ${equipments.length} equipments with maintenance history.`);

// --- 5. Projects & Phases ---
const projType = await ProjectType.findOne();
const mainWarehouse = await Warehouse.findOne({ type: "MAIN" }) || await Warehouse.create({ name: "المستودع الرئيسي", type: "MAIN" });

const projects = [];
const p1 = await Project.create({
  name: "مشروع مجمع تجاري الرياض",
  code: "PRJ-RYD-001",
  type: projType?._id || new mongoose.Types.ObjectId(),
  status: "EXECUTION",
  priority: "HIGH",
  manager: employees[0]._id, // أحمد
  budget: 5000000,
  warehouseType: "SHARED",
  startDate: new Date("2025-01-01")
});
projects.push(p1);

const phase1 = await ProjectPhase.create({
  project: p1._id,
  name: "Phase 1",
  nameAr: "أعمال الحفر والأساسات",
  nameEn: "Excavation and Foundations",
  order: 1,
  status: "IN_PROGRESS",
  budget: 1000000
});

// Assign Equipment to Project
await EquipmentAssignment.create({
  equipment: equipments[0]._id, // Crane
  project: p1._id,
  phase: phase1._id,
  startDate: new Date("2025-02-01"),
  status: "ACTIVE",
  dailyCostSnapshot: equipments[0].dailyCost
});
await EquipmentAssignment.create({
  equipment: equipments[1]._id, // Excavator
  project: p1._id,
  startDate: new Date("2025-01-15"),
  endDate: new Date("2025-03-01"),
  status: "RETURNED",
  dailyCostSnapshot: equipments[1].dailyCost
});

// Assign Members
await ProjectMember.create({ project: p1._id, user: employees[0]._id, role: "مدير الموقع" });
await ProjectMember.create({ project: p1._id, user: employees[1]._id, role: "مشرف عمال" });

const p2 = await Project.create({
  name: "مشروع بنية تحتية - طريق الملك فهد",
  code: "PRJ-INF-002",
  type: projType?._id || new mongoose.Types.ObjectId(),
  status: "PLANNING",
  priority: "MEDIUM",
  budget: 15000000
});
projects.push(p2);
console.log(`✅ Seeded 2 projects with phases, equipment, and members.`);

// --- 6. HR Requests (Vacations, etc) ---
await HrRequest.create({
  user: employees[3]._id, // مروان
  requestType: "LEAVE",
  startDate: new Date("2025-10-01"),
  endDate: new Date("2025-10-15"),
  reason: "إجازة سنوية للسفر",
  status: "APPROVED",
  relatedProject: p1._id
});

await HrRequest.create({
  user: employees[2]._id, // يوسف
  requestType: "OVERTIME",
  startDate: new Date(),
  reason: "أعمال صب الخرسانة الليلية",
  status: "PENDING",
  relatedProject: p1._id
});

console.log(`✅ Seeded HR Requests (Leave, Overtime).`);

// --- 7. Procurement / Material Requests ---
const matCat = await MaterialCategory.findOne() || await MaterialCategory.create({ name: "مواد بناء" });
const matUnit = await MeasurementUnit.findOne() || await MeasurementUnit.create({ name: "طن", symbol: "t" });
const mat1 = await Material.findOne({ name: "أسمنت بورتلاند" }) || await Material.create({ name: "أسمنت بورتلاند", category: matCat._id, unit: matUnit._id, standardCost: 250 });
const mat2 = await Material.findOne({ name: "حديد تسليح 16مم" }) || await Material.create({ name: "حديد تسليح 16مم", category: matCat._id, unit: matUnit._id, standardCost: 3500 });
const mat3 = await Material.findOne({ name: "رمل بناء" }) || await Material.create({ name: "رمل بناء", category: matCat._id, unit: matUnit._id, standardCost: 50 });

// Seed Inventory levels in the Main Warehouse for these materials
await Inventory.create([
  { warehouse: mainWarehouse._id, material: mat1._id, quantity: 5000, lastUpdated: new Date() },
  { warehouse: mainWarehouse._id, material: mat2._id, quantity: 500, lastUpdated: new Date() }, // 500 tons
  { warehouse: mainWarehouse._id, material: mat3._id, quantity: 2000, lastUpdated: new Date() } // 2000 tons
]);

await MaterialRequest.create({
  project: p1._id,
  phase: phase1._id,
  warehouse: mainWarehouse._id,
  requestedBy: employees[0]._id, // أحمد
  status: "APPROVED",
  materials: [
    { material: mat1._id, quantity: 50, unitCost: 250, totalCost: 12500 }
  ],
  totalRequestCost: 12500,
  notes: "مطلوب بشكل عاجل لأعمال الأساسات"
});

await MaterialRequest.create({
  project: p2._id,
  warehouse: mainWarehouse._id,
  requestedBy: employees[0]._id, 
  status: "PENDING",
  materials: [
    { material: mat1._id, quantity: 100, unitCost: 250, totalCost: 25000 }
  ],
  totalRequestCost: 25000,
  notes: "طلب تسعير ومستودع لبداية المشروع"
});

console.log(`✅ Seeded Material Requests (Procurement).`);

// --- 8. Phase Tasks ---
phase1.tasks.push({
  name: "تجهيز الموقع وتسويره",
  description: "الانتهاء من الأسوار المؤقتة والبوابات",
  assignedTo: employees[0]._id, // أحمد
  priority: "HIGH",
  status: "IN_PROGRESS"
});
phase1.tasks.push({
  name: "الحفر الميكانيكي",
  description: "حفر الأساسات للبرج الرئيسي",
  assignedTo: employees[1]._id,
  priority: "HIGH",
  status: "PENDING"
});
await phase1.save();
console.log(`✅ Seeded Phase Tasks.`);

// --- 9. Support Tickets (Ticketing API) ---
await Ticket.create({
  type: "MAINTENANCE",
  project: p1._id,
  equipment: equipments[0]._id,
  description: "عطل طارئ في الرافعة أثناء التشغيل",
  priority: "HIGH",
  status: "IN_PROGRESS",
  requester: employees[0]._id,
  assignedTeam: [employees[2]._id]
});
await Ticket.create({
  type: "SUPPORT",
  project: p2._id,
  description: "طلب دعم فني في برمجيات الموقع",
  priority: "MEDIUM",
  status: "NEW",
  requester: employees[3]._id
});
console.log(`✅ Seeded Tickets.`);

// --- 10. Procurement (Suppliers & RFQs) ---
const supplier1 = await Supplier.create({
  name: "شركة مواد البناء المتقدمة",
  code: "SUP-001",
  category: "مواد بناء",
  contactPerson: "سعيد علي",
  email: "saeed@advanced.com",
  phone: "0501234567",
  status: "ACTIVE",
  rating: 4.5,
  suppliedMaterials: [mat1._id, mat2._id]
});

const rfq1 = await RFQ.create({
  project: p1._id,
  materialRequest: await MaterialRequest.findOne(), // Pick any
  createdBy: employees[0]._id,
  title: "تسعير أسمنت وحديد للمشروع",
  description: "مطلوب عروض أسعار مبدئية لأساسات المجمع التجاري",
  deadline: new Date("2026-06-01"),
  status: "SENT",
  items: [
    { material: mat1._id, quantity: 100, unitCost: 0, totalCost: 0 },
    { material: mat2._id, quantity: 50, unitCost: 0, totalCost: 0 }
  ],
  eligibleSuppliers: [supplier1._id]
});
console.log(`✅ Seeded Suppliers and RFQs.`);

console.log("🎉 All Demo Data Seeded Successfully!");
process.exit(0);
