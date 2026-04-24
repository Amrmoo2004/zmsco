import mongoose from "mongoose";
import dotenv from "dotenv";

// Models
import Role from "../db/models/roles.js";
import User from "../db/models/user.js";
import Project from "../db/models/projects/project.js";
import ProjectPhase from "../db/models/projects/project.phase.js";
import ProjectMember from "../db/models/projects/project.member.js";
import { Equipment, EquipmentAssignment } from "../db/models/hr/equipment.model.js";
import MaterialRequest from "../db/models/metrials/materialRequest.model.js";
import Material from "../db/models/metrials/metrials.js";
import Warehouse from "../db/models/warehouse.model.js";
import ProjectType from "../db/models/settings/projectType.model.js";
import MaterialCategory from "../db/models/settings/materialCategory.model.js";
import MeasurementUnit from "../db/models/settings/measurementUnit.model.js";
import JobTitle from "../db/models/settings/jobTitle.model.js";
import Ticket from "../db/models/tickets/ticket.model.js";
import Inventory from "../db/models/inventory.js";
import Department from "../db/models/settings/department.model.js";

// Procurement & HR
import Supplier from "../db/models/procurement/supplier.model.js";
import RFQ from "../db/models/procurement/rfq.model.js";
import Quote from "../db/models/procurement/quote.model.js";
import PurchaseOrder from "../db/models/procurement/purchaseOrder.model.js";
import GoodsReceipt from "../db/models/procurement/goodsReceipt.model.js";
import HrRequest from "../db/models/hr/hrRequest.model.js";

dotenv.config();

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.URL_DATABASE);
    console.log("🌱 Starting Frontend Test Data Seeder...");

    // 1. Get or create base settings (Roles, Depts, Jobs)
    const adminRole = await Role.findOne({ name: "ADMIN" }) || await Role.create({ name: "ADMIN", nameAr: "مدير نظام" });
    const pmRole = await Role.findOne({ name: "PROJECT_MANAGER" }) || await Role.create({ name: "PROJECT_MANAGER", nameAr: "مدير مشروع" });
    const siteEngRole = await Role.findOne({ name: "SITE_ENGINEER" }) || await Role.create({ name: "SITE_ENGINEER", nameAr: "مهندس موقع" });

    const engineeringDept = await Department.findOne({ nameEn: "Engineering Department" }) || await Department.create({ nameAr: "الإدارة الهندسية", nameEn: "Engineering Department", code: "ENG-001" });

    const pmJob = await JobTitle.findOne({ nameEn: "Project Manager" }) || await JobTitle.create({ nameAr: "مدير مشروع", nameEn: "Project Manager", code: "JOB-PM", department: engineeringDept._id });
    const siteEngJob = await JobTitle.findOne({ nameEn: "Site Engineer" }) || await JobTitle.create({ nameAr: "مهندس موقع", nameEn: "Site Engineer", code: "JOB-ENG", department: engineeringDept._id });

    // 2. Create Test Users
    const timestamp = Date.now();
    const pmUser = await User.create({
      name: `مدير مشروع تجريبي ${timestamp}`,
      email: `pm_${timestamp}@test.com`,
      password: "password123",
      role: pmRole._id,
      jobTitle: pmJob._id,
      status: "AVAILABLE",
    });

    const engUser1 = await User.create({
      name: `مهندس موقع أول ${timestamp}`,
      email: `eng1_${timestamp}@test.com`,
      password: "password123",
      role: siteEngRole._id,
      jobTitle: siteEngJob._id,
      status: "AVAILABLE",
    });

    const engUser2 = await User.create({
      name: `مهندس موقع ثاني ${timestamp}`,
      email: `eng2_${timestamp}@test.com`,
      password: "password123",
      role: siteEngRole._id,
      jobTitle: siteEngJob._id,
      status: "AVAILABLE",
    });

    // 3. Project Type & Warehouse
    const projType = await ProjectType.findOne() || await ProjectType.create({ name: "مجمع سكني", nameAr: "مجمع سكني" });
    const mainWarehouse = await Warehouse.findOne({ type: "MAIN" }) || await Warehouse.create({ name: "المستودع الرئيسي", type: "MAIN" });

    // 4. Create the Master Project
    const project = await Project.create({
      name: `مشروع تجريبي متكامل للواجهة - ${new Date().toLocaleDateString('ar-EG')}`,
      code: `PRJ-TEST-${Math.floor(Math.random() * 10000)}`,
      type: projType._id,
      status: "EXECUTION",
      priority: "HIGH",
      manager: pmUser._id,
      budget: 12000000,
      warehouseType: "SHARED",
      startDate: new Date(),
    });
    console.log(`✅ Project created: ${project.name}`);

    // 5. Add Individuals (Project Members)
    await ProjectMember.create([
      { project: project._id, user: pmUser._id, role: "مدير المشروع" },
      { project: project._id, user: engUser1._id, role: "مهندس إشراف" },
      { project: project._id, user: engUser2._id, role: "مهندس جودة" }
    ]);
    console.log(`✅ Individuals (Project Members) added.`);

    // 6. Project Phases (with Tasks and Approvals)
    // Phase 1: Planning (Completed)
    const phase1 = await ProjectPhase.create({
      project: project._id,
      name: "Planning & Design",
      nameAr: "التخطيط والتصميم",
      order: 1,
      status: "COMPLETED",
      budget: 500000,
      startDate: new Date(Date.now() - 30 * 86400000), // 30 days ago
      endDate: new Date(Date.now() - 5 * 86400000), // 5 days ago
      requiredApprovals: [
        { role: adminRole._id, user: pmUser._id, status: "APPROVED", actionDate: new Date(), notes: "تمت الموافقة على التصاميم المبدئية" }
      ],
      tasks: [
        { name: "تجهيز المخططات الهندسية", description: "رسم واعتماد المخطط المعماري والإنشائي", assignedTo: engUser1._id, priority: "HIGH", status: "COMPLETED", completedAt: new Date() },
        { name: "استخراج تصاريح البناء", description: "مراجعة البلدية لاستخراج الرخص", assignedTo: engUser2._id, priority: "MEDIUM", status: "COMPLETED", completedAt: new Date() }
      ]
    });

    // Phase 2: Execution (In Progress)
    const phase2 = await ProjectPhase.create({
      project: project._id,
      name: "Execution & Structure",
      nameAr: "التنفيذ والأعمال الإنشائية",
      order: 2,
      status: "IN_PROGRESS",
      budget: 8000000,
      startDate: new Date(Date.now() - 2 * 86400000),
      endDate: new Date(Date.now() + 60 * 86400000),
      requiredApprovals: [
        { role: pmRole._id, user: pmUser._id, status: "PENDING", notes: "في انتظار فحص الجودة لاستلام القواعد" }
      ],
      tasks: [
        { name: "أعمال الحفر وتجهيز الموقع", description: "حفر الأساسات بعمق 4 متر", assignedTo: engUser1._id, priority: "HIGH", status: "COMPLETED", completedAt: new Date() },
        { name: "صب القواعد الخرسانية", description: "صب القواعد المنفصلة والمشتركة", assignedTo: engUser1._id, priority: "HIGH", status: "IN_PROGRESS" },
        { name: "أعمال الحدادة للرقاب", description: "قص وثني الحديد لرقاب الأعمدة", assignedTo: engUser2._id, priority: "MEDIUM", status: "PENDING" }
      ]
    });

    // Phase 3: Finishing (Pending)
    const phase3 = await ProjectPhase.create({
      project: project._id,
      name: "Finishing & Handover",
      nameAr: "التشطيبات والتسليم",
      order: 3,
      status: "PENDING",
      budget: 3500000,
      requiredApprovals: [
        { role: pmRole._id, status: "PENDING" },
        { role: adminRole._id, status: "PENDING" }
      ],
      tasks: [
        { name: "أعمال السباكة والكهرباء التأسيسية", priority: "HIGH", status: "PENDING", assignedTo: engUser2._id },
        { name: "اللياسة والدهانات", priority: "MEDIUM", status: "PENDING", assignedTo: engUser1._id }
      ]
    });
    console.log(`✅ Project Phases, Tasks, and Approvals added.`);

    // 7. Inventory & Materials
    const matCat = await MaterialCategory.findOne() || await MaterialCategory.create({ name: "مواد بناء أساسية" });
    const matUnit = await MeasurementUnit.findOne() || await MeasurementUnit.create({ name: "طن", symbol: "t" });
    
    const cement = await Material.findOne({ name: "أسمنت مقاوم" }) || await Material.create({ name: "أسمنت مقاوم", category: matCat._id, unit: matUnit._id, standardCost: 300 });
    const steel = await Material.findOne({ name: "حديد تسليح سابك 16مم" }) || await Material.create({ name: "حديد تسليح سابك 16مم", category: matCat._id, unit: matUnit._id, standardCost: 3800 });

    // Use findOneAndUpdate to prevent duplicate key errors if the inventory record already exists
    await Inventory.findOneAndUpdate(
      { warehouse: mainWarehouse._id, material: cement._id },
      { $inc: { quantity: 2000 }, $set: { lastUpdated: new Date() } },
      { upsert: true }
    );
    await Inventory.findOneAndUpdate(
      { warehouse: mainWarehouse._id, material: steel._id },
      { $inc: { quantity: 500 }, $set: { lastUpdated: new Date() } },
      { upsert: true }
    );

    // Material Request for the project
    await MaterialRequest.create({
      project: project._id,
      phase: phase2._id,
      warehouse: mainWarehouse._id,
      requestedBy: engUser1._id,
      status: "APPROVED",
      materials: [
        { material: cement._id, quantity: 200, approvedQuantity: 200, issuedQuantity: 50, unitCost: 300, totalCost: 60000 },
        { material: steel._id, quantity: 50, approvedQuantity: 50, issuedQuantity: 10, unitCost: 3800, totalCost: 190000 }
      ],
      totalRequestCost: 250000,
      notes: "مواد مطلوبة بشكل عاجل لصب القواعد الخرسانية"
    });
    console.log(`✅ Inventory and Material Requests added.`);

    // 8. Equipment
    const eq1 = await Equipment.findOne({ type: "Excavator" }) || await Equipment.create({ name: "حفار مجنزر تجريبي", type: "Excavator", dailyCost: 1000, condition: "GOOD" });
    await EquipmentAssignment.create({
      equipment: eq1._id,
      project: project._id,
      phase: phase2._id,
      startDate: new Date(),
      status: "ACTIVE",
      dailyCostSnapshot: eq1.dailyCost
    });
    console.log(`✅ Equipment Assignment added.`);

    // 9. Tickets
    await Ticket.create({
      type: "MAINTENANCE",
      project: project._id,
      projectPhase: phase2._id,
      equipment: eq1._id,
      description: "صوت غیر طبيعي في محرك الحفار أثناء العمل المستمر",
      priority: "HIGH",
      status: "UNDER_REVIEW",
      requester: engUser1._id,
      assignedTeam: [engUser2._id],
      comments: [
        { user: engUser1._id, text: "يرجى فحص المعدة بأسرع وقت لتجنب تأخير الحفر", createdAt: new Date() }
      ]
    });
    console.log(`✅ Ticket added.`);

    // 10. Procurement (Suppliers, RFQ, Quote, PO)
    const supplier = await Supplier.findOne({ name: "شركة البناء الحديث للتوريدات" }) || await Supplier.create({
      name: "شركة البناء الحديث للتوريدات",
      code: "SUP-TEST",
      category: "مواد بناء",
      contactPerson: "محمد علي",
      email: "sales@benaa.com",
      phone: "0501234567",
      status: "ACTIVE",
      rating: 4.8,
      suppliedMaterials: [cement._id, steel._id]
    });

    const rfq = await RFQ.create({
      project: project._id,
      phase: phase2._id,
      createdBy: pmUser._id,
      deadline: new Date(Date.now() + 7 * 86400000), // Next week
      status: "CLOSED", // Assuming we already got quotes and generated a PO
      items: [
        { material: cement._id, quantity: 200 },
        { material: steel._id, quantity: 50 }
      ],
      suppliers: [supplier._id]
    });

    const quote = await Quote.create({
      rfq: rfq._id,
      supplier: supplier._id,
      items: [
        { material: cement._id, quantity: 200, unitPrice: 290, description: "سعر خاص للكميات" },
        { material: steel._id, quantity: 50, unitPrice: 3750, description: "جاهز للتسليم الفوري" }
      ],
      totalAmount: 245500,
      deliveryDays: 3,
      validityDays: 30,
      status: "SELECTED",
      submittedAt: new Date()
    });

    const po = await PurchaseOrder.create({
      quote: quote._id,
      rfq: rfq._id,
      supplier: supplier._id,
      project: project._id,
      poNumber: `PO-${new Date().getFullYear()}-001`,
      createdBy: pmUser._id,
      totalAmount: 245500,
      status: "RECEIVED",
      deliveryDate: new Date(Date.now() + 3 * 86400000),
      items: [
        { material: cement._id, quantity: 200, unitPrice: 290 },
        { material: steel._id, quantity: 50, unitPrice: 3750 }
      ]
    });

    // 11. HR Requests
    await HrRequest.create({
      user: engUser1._id,
      requestType: "LEAVE",
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 15 * 86400000),
      reason: "إجازة طارئة لظروف عائلية",
      status: "APPROVED",
      relatedProject: project._id
    });
    console.log(`✅ Procurement (Supplier, RFQ, Quote, PO) and HR Requests added.`);

    console.log(`\n🎉 SEED COMPLETE!`);
    console.log(`===========================================`);
    console.log(`🧪 TEST PROJECT CREATED:`);
    console.log(`- Project Name: ${project.name}`);
    console.log(`- Project Manager: ${pmUser.name}`);
    console.log(`- Includes: Phases, Tasks, Approvals, Members, Inventory, Equipment, Tickets`);
    console.log(`===========================================`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
};

runSeed();
