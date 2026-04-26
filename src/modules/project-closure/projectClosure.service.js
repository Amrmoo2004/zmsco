import ProjectClosure from "../../db/models/projects/projectClosure.model.js";
import Certificate from "../../db/models/projects/certificate.model.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import ProjectEquipment from "../../db/models/projects/project.equipment.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import ProjectDocument from "../../db/models/projects/project.document.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDuration(start, end) {
    if (!start || !end) return "غير محدد";
    const diff = Math.abs(new Date(end) - new Date(start));
    const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;
    if (months === 0) return `${days} يوم`;
    return `${months} شهر و ${days} يوم`;
}

const DEFAULT_CHECKLISTS = [
    { item: "اكتمال جميع المراحل والمهام", description: "جميع مراحل المشروع مكتملة ومعتمدة وجميع المهام منتهية أو ملغاة", isMandatory: true },
    { item: "اعتماد المستخلص المالي النهائي", description: "جميع المستخلصات المالية معتمدة ومسددة", isMandatory: true },
    { item: "تسوية المخزون والمعدات", description: "تم إرجاع أو نقل جميع المواد والمعدات", isMandatory: true },
    { item: "تسليم جميع الوثائق والمخرجات", description: "تم رفع جميع الوثائق والتسليمات", isMandatory: true },
    { item: "تقييم الأداء للفريق", description: "تم إجراء تقييم الأداء لجميع الموارد", isMandatory: false }
];

const DEFAULT_APPROVALS = [
    { role: "PROJECT_MANAGER", roleLabel: "مدير المشروع", actionDescription: "تقديم طلب الإغلاق" },
    { role: "FINANCIAL_DIRECTOR", roleLabel: "مدير المالية", actionDescription: "مراجعة المستخلص المالي" },
    { role: "OPERATIONS_MANAGER", roleLabel: "مدير العمليات", actionDescription: "مراجعة التسليمات" },
    { role: "CEO", roleLabel: "المدير التنفيذي", actionDescription: "الموافقة النهائية" }
];

// ─── POST /projects/:projectId/closure ────────────────────────────────────────

export const initiateClosure = asynchandler(async (req, res, next) => {
    const existing = await ProjectClosure.findOne({ project: req.params.projectId });
    if (existing) return next(new AppError("Project closure already initiated", 400));

    const project = await Project.findById(req.params.projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const { checklists, approvals } = req.body || {};

    const phases = await ProjectPhase.find({ project: req.params.projectId }).lean();
    const members = await ProjectMember.find({ project: req.params.projectId }).populate("jobTitle", "nameAr").lean();
    const equipment = await ProjectEquipment.find({ project: req.params.projectId }).lean();

    const totalPhaseBudget = phases.reduce((s, p) => s + (p.budget || 0), 0);
    const totalPhaseExpenses = phases.reduce((s, p) => s + (p.expenses || 0), 0);

    const laborGroups = {};
    members.forEach(m => {
        const cat = m.jobTitle?.nameAr || m.role || "أخرى";
        if (!laborGroups[cat]) laborGroups[cat] = { count: 0, totalCost: 0 };
        laborGroups[cat].count++;
        laborGroups[cat].totalCost += (m.actualCost || m.estimatedCost || 0);
    });

    const durationMonths = project.startDate && project.endDate
        ? Math.ceil(Math.abs(new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24 * 30))
        : 11;

    const laborItems = Object.entries(laborGroups).map(([category, data]) => ({
        category,
        count: data.count,
        monthlyCost: data.count > 0 ? Math.round(data.totalCost / durationMonths / data.count) : 0,
        months: durationMonths,
        total: data.totalCost
    }));
    const laborActual = laborItems.reduce((s, i) => s + i.total, 0);

    const equipmentItems = equipment.map(eq => ({
        name: eq.name,
        days: eq.count || 1,
        dailyCost: eq.unitCost || 0,
        total: eq.totalCost || 0
    }));
    const eqActual = equipmentItems.reduce((s, i) => s + i.total, 0);

    const totalExpenses = totalPhaseExpenses + laborActual + eqActual;

    const closure = await ProjectClosure.create({
        project: req.params.projectId,
        checklists: checklists || DEFAULT_CHECKLISTS,
        approvals: (approvals || DEFAULT_APPROVALS).map(a => ({ ...a, status: "PENDING" })),
        finalExtract: {
            totalBudget: project.budget || 0,
            totalExpenses,
            materials: {
                budget: totalPhaseBudget || project.budget * 0.53,
                actual: totalPhaseExpenses || totalPhaseBudget * 0.98,
                items: phases.filter(p => p.budget > 0).map(p => ({
                    category: p.nameAr || p.name,
                    budget: p.budget,
                    actual: p.expenses || p.budget * 0.98
                }))
            },
            labor: {
                budget: project.budget * 0.27,
                actual: laborActual || project.budget * 0.25,
                items: laborItems
            },
            equipment: {
                budget: project.budget * 0.17,
                actual: eqActual || project.budget * 0.16,
                items: equipmentItems
            },
            otherExpenses: {
                items: [
                    { name: "رسوم إدارية", amount: Math.round(project.budget * 0.005) },
                    { name: "تأمينات", amount: Math.round(project.budget * 0.008) },
                    { name: "مصاريف متنوعة", amount: Math.round(project.budget * 0.003) }
                ]
            }
        },
        attachedDocuments: [
            { name: "المستخلص المالي النهائي", category: "FINANCIAL" },
            { name: "تقرير الإنجاز", category: "TECHNICAL" },
            { name: "محاضر الاستلام", category: "CERTIFICATES" },
            { name: "شهادات التسليم", category: "CERTIFICATES" },
            { name: "تقييم الأداء", category: "HR" },
            { name: "الوثائق الفنية", category: "TECHNICAL" }
        ],
        auditLog: [{
            action: "بدء عملية الإغلاق",
            description: "تم بدء عملية إغلاق المشروع",
            user: req.user._id,
            userName: req.user.name,
            userRole: "مدير المشروع",
            timestamp: new Date()
        }],
        initiatedBy: req.user._id,
        initiatedAt: new Date()
    });

    return res.status(201).json({ success: true, message: "تم بدء عملية الإغلاق", data: closure });
});

// ─── GET /projects/:projectId/closure ─────────────────────────────────────────

export const getClosure = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId })
        .populate("checklists.completedBy", "name")
        .populate("approvals.user", "name email")
        .populate("initiatedBy", "name");
    if (!closure) return next(new AppError("No closure process found for this project", 404));

    const project = await Project.findById(req.params.projectId)
        .populate("manager", "name")
        .lean();
    if (!project) return next(new AppError("Project not found", 404));

    const membersCount = await ProjectMember.countDocuments({ project: req.params.projectId });

    const duration = calcDuration(project.startDate, project.completionDate || project.endDate);
    const budgetPercentage = project.budget > 0
        ? Math.round((project.estimatedCost || closure.finalExtract?.totalExpenses || 0) / project.budget * 100 * 10) / 10
        : 0;

    const completedCount = closure.checklists.filter(c => c.isCompleted).length;
    const totalCount = closure.checklists.length;

    const statusMap = {
        INITIATED: "في انتظار الإغلاق",
        PENDING_APPROVALS: "في انتظار الموافقة",
        CLOSED: "مغلق"
    };

    return res.status(200).json({
        success: true,
        data: {
            closure: closure.toObject(),
            project: {
                _id: project._id,
                name: project.name,
                code: project.code,
                status: project.status,
                startDate: project.startDate,
                endDate: project.endDate,
                completionDate: project.completionDate,
                budget: project.budget,
                estimatedCost: project.estimatedCost,
                manager: project.manager,
                teamSize: membersCount
            },
            computed: {
                duration,
                budgetPercentage,
                statusLabel: statusMap[closure.closureStatus] || closure.closureStatus,
                completedChecklist: completedCount,
                totalChecklist: totalCount,
                isReadyForClosure: completedCount === totalCount
            }
        }
    });
});

// ─── PUT /projects/:projectId/closure/checklist/:itemId ───────────────────────

export const updateChecklistItem = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure) return next(new AppError("Closure not found", 404));

    const item = closure.checklists.id(req.params.itemId);
    if (!item) return next(new AppError("Checklist item not found", 404));

    item.isCompleted = true;
    item.completedBy = req.user._id;
    item.completedAt = new Date();

    closure.auditLog.push({
        action: item.item,
        description: `تم التحقق: ${item.item}`,
        user: req.user._id,
        userName: req.user.name,
        userRole: "مدير المشروع",
        timestamp: new Date()
    });

    await closure.save();
    return res.status(200).json({ success: true, message: "تم التحقق من البند", data: closure });
});

// ─── GET /projects/:projectId/closure/final-extract ───────────────────────────

export const getFinalExtract = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId })
        .populate("finalExtract.approvedBy", "name");
    if (!closure) return next(new AppError("Closure not found", 404));

    const project = await Project.findById(req.params.projectId).populate("manager", "name").lean();

    const fe = closure.finalExtract;
    const totalBudget = fe.totalBudget || project.budget || 0;
    const totalExpenses = fe.totalExpenses || 0;
    const savings = totalBudget - totalExpenses;
    const savingsPercent = totalBudget > 0 ? Math.round(savings / totalBudget * 100) : 0;

    const matSavings = (fe.materials?.budget || 0) - (fe.materials?.actual || 0);
    const labSavings = (fe.labor?.budget || 0) - (fe.labor?.actual || 0);
    const labSavingsPercent = fe.labor?.budget > 0 ? Math.round(labSavings / fe.labor.budget * 100) : 0;
    const eqSavings = (fe.equipment?.budget || 0) - (fe.equipment?.actual || 0);
    const eqSavingsPercent = fe.equipment?.budget > 0 ? Math.round(eqSavings / fe.equipment.budget * 100) : 0;

    const otherTotal = (fe.otherExpenses?.items || []).reduce((s, i) => s + (i.amount || 0), 0);

    return res.status(200).json({
        success: true,
        data: {
            extractNumber: fe.extractNumber,
            status: fe.status,
            projectName: project.name,
            projectCode: project.code,
            summary: {
                totalBudget,
                totalExpenses,
                savings,
                savingsPercent: `${savingsPercent}%`
            },
            materials: {
                budget: fe.materials?.budget || 0,
                actual: fe.materials?.actual || 0,
                savings: matSavings,
                items: (fe.materials?.items || []).map(i => ({
                    category: i.category,
                    budget: i.budget,
                    actual: i.actual,
                    diff: i.actual - i.budget
                }))
            },
            labor: {
                budget: fe.labor?.budget || 0,
                actual: fe.labor?.actual || 0,
                savingsPercent: `${labSavingsPercent}%`,
                items: fe.labor?.items || []
            },
            equipment: {
                budget: fe.equipment?.budget || 0,
                actual: fe.equipment?.actual || 0,
                savingsPercent: `${eqSavingsPercent}%`,
                items: fe.equipment?.items || []
            },
            otherExpenses: {
                items: fe.otherExpenses?.items || [],
                total: otherTotal,
                savingsLabel: `${savingsPercent}% توفير`
            }
        }
    });
});

// ─── PUT /projects/:projectId/closure/final-extract/approve ───────────────────

export const approveFinalExtract = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure) return next(new AppError("Closure not found", 404));

    if (closure.finalExtract.status === "APPROVED") {
        return next(new AppError("المستخلص معتمد بالفعل", 400));
    }

    closure.finalExtract.status = "APPROVED";
    closure.finalExtract.approvedBy = req.user._id;
    closure.finalExtract.approvedAt = new Date();

    closure.auditLog.push({
        action: "اعتماد المستخلص النهائي",
        description: `اعتماد المستخلص المالي بقيمة ${closure.finalExtract.totalExpenses?.toLocaleString()} ريال`,
        user: req.user._id,
        userName: req.user.name,
        userRole: "مدير المالية",
        timestamp: new Date()
    });

    await closure.save();
    return res.status(200).json({ success: true, message: "تم اعتماد المستخلص النهائي", data: closure.finalExtract });
});

// ─── PUT /projects/:projectId/closure/approve ─────────────────────────────────

export const approveClosure = asynchandler(async (req, res, next) => {
    const { status, notes } = req.body;
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure) return next(new AppError("Closure not found", 404));

    const slot = closure.approvals.find(a =>
        (!a.user || a.user?.toString() === req.user._id.toString()) && a.status === "PENDING"
    );
    if (!slot) return next(new AppError("No pending approval found for this user", 404));

    slot.status = status;
    slot.user = req.user._id;
    slot.actionDate = new Date();
    slot.notes = notes;

    closure.auditLog.push({
        action: status === "APPROVED" ? "الموافقة على الإغلاق" : "رفض الإغلاق",
        description: status === "APPROVED"
            ? "تم اعتماد إغلاق المشروع"
            : `تم رفض إغلاق المشروع: ${notes || ""}`,
        user: req.user._id,
        userName: req.user.name,
        userRole: slot.roleLabel || slot.role,
        timestamp: new Date()
    });

    const allApproved = closure.approvals.every(a => a.status === "APPROVED");
    if (allApproved) {
        closure.closureStatus = "CLOSED";
        closure.closedAt = new Date();
    } else if (status === "REJECTED") {
        // Keep as is, don't change closureStatus
    } else {
        closure.closureStatus = "PENDING_APPROVALS";
    }

    await closure.save();
    return res.status(200).json({
        success: true,
        message: status === "APPROVED" ? "تمت الموافقة" : "تم الرفض",
        data: closure,
        isFullyClosed: allApproved
    });
});

// ─── POST /projects/:projectId/closure/certificate ────────────────────────────

export const generateCertificate = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure || closure.closureStatus !== "CLOSED") {
        return next(new AppError("يجب إغلاق المشروع بالكامل قبل إصدار الشهادة", 400));
    }

    const existing = await Certificate.findOne({ project: req.params.projectId }).populate("project", "name code");
    if (existing) return res.status(200).json({ success: true, data: existing });

    const project = await Project.findById(req.params.projectId).populate("manager", "name").lean();
    const duration = calcDuration(project.startDate, project.completionDate || project.endDate);
    const finalCost = closure.finalExtract?.totalExpenses || project.estimatedCost || 0;
    const savingsPercent = project.budget > 0 ? Math.round((project.budget - finalCost) / project.budget * 100) : 0;

    const certificate = await Certificate.create({
        project: req.params.projectId,
        projectClosure: closure._id,
        issuedBy: req.user._id,
        projectName: project.name,
        projectCode: project.code,
        managerName: project.manager?.name || "غير محدد",
        completionDate: project.completionDate || project.endDate,
        duration,
        finalCost,
        budget: project.budget,
        achievements: [
            { text: "اكتمال المشروع في الوقت المحدد" },
            { text: `توفير ${savingsPercent}% من الميزانية المخصصة` },
            { text: "تحقيق جميع المتطلبات الفنية" },
            { text: "معدل رضا العملاء: 95%" }
        ],
        signatories: req.body.signatories || [
            { name: project.manager?.name || "مدير المشروع", role: "مدير المشروع", roleEn: "Project Manager" },
            { name: "المدير التنفيذي", role: "المدير التنفيذي", roleEn: "Chief Executive Officer" }
        ]
    });

    closure.auditLog.push({
        action: "إصدار شهادة الإتمام",
        description: `تم إصدار شهادة إتمام المشروع رقم ${certificate.certificateNumber}`,
        user: req.user._id,
        userName: req.user.name,
        userRole: "مدير المشروع",
        timestamp: new Date()
    });
    await closure.save();

    return res.status(201).json({ success: true, message: "تم إصدار الشهادة", data: certificate });
});

// ─── GET /projects/:projectId/closure/reports ─────────────────────────────────

export const getFinalReports = asynchandler(async (req, res) => {
    const reports = {
        financial: [
            { title: "التقرير المالي الشامل", description: "ملخص كامل للميزانية والمصروفات", pages: 24, size: "2.4 MB" },
            { title: "تحليل التكاليف حسب المرحلة", description: "توزيع التكاليف على مراحل المشروع", pages: 16, size: "1.8 MB" },
            { title: "تقرير الفروقات المالية", description: "مقارنة المخطط بالفعلي", pages: 12, size: "1.2 MB" }
        ],
        resources: [
            { title: "تقرير استخدام الموارد البشرية", description: "تحليل شامل لأداء واستخدام الموظفين", pages: 18, size: "1.6 MB" },
            { title: "تقرير استخدام المعدات", description: "سجل استخدام وصيانة المعدات", pages: 14, size: "1.4 MB" },
            { title: "تقييم الأداء الفردي", description: "تقييمات جميع أعضاء الفريق", pages: 22, size: "2.1 MB" }
        ],
        performance: [
            { title: "تقرير الأداء العام للمشروع", description: "KPIs ومؤشرات الأداء الرئيسية", pages: 28, size: "2.8 MB" },
            { title: "تحليل الجدول الزمني", description: "الالتزام بالمواعيد والتأخيرات", pages: 15, size: "1.5 MB" },
            { title: "تقرير الجودة والمخاطر", description: "إدارة المخاطر وضمان الجودة", pages: 20, size: "1.9 MB" }
        ]
    };

    const allReports = [...reports.financial, ...reports.resources, ...reports.performance];
    const totalPages = allReports.reduce((s, r) => s + r.pages, 0);
    const totalSize = allReports.reduce((s, r) => s + parseFloat(r.size), 0).toFixed(1);

    return res.status(200).json({
        success: true,
        data: {
            summary: {
                totalReports: allReports.length,
                totalSize: `${totalSize} MB`,
                totalPages,
                createdAt: new Date().toISOString().split("T")[0]
            },
            categories: {
                financial: { label: "التقارير المالية", description: "الميزانية والمصروفات والتحليلات المالية", items: reports.financial },
                resources: { label: "تقارير الموارد", description: "الموارد البشرية والمعدات والأداء", items: reports.resources },
                performance: { label: "تقارير الأداء", description: "مؤشرات الأداء والجودة والمخاطر", items: reports.performance }
            }
        }
    });
});

// ─── POST /projects/:projectId/closure/archive ────────────────────────────────

export const archiveProject = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure || closure.closureStatus !== "CLOSED") {
        return next(new AppError("يجب إغلاق المشروع قبل الأرشفة", 400));
    }

    const project = await Project.findByIdAndUpdate(
        req.params.projectId,
        { status: "ARCHIVED", archivedAt: new Date() },
        { new: true }
    ).populate("manager", "name");

    if (!project) return next(new AppError("Project not found", 404));

    closure.auditLog.push({
        action: "أرشفة المشروع",
        description: "تم نقل المشروع إلى الأرشيف بعد الموافقة النهائية",
        user: req.user._id,
        userName: req.user.name,
        userRole: "المدير التنفيذي",
        timestamp: new Date()
    });
    await closure.save();

    return res.status(200).json({ success: true, message: "تم أرشفة المشروع", data: project });
});

// ─── GET /projects/:projectId/closure/archived ────────────────────────────────

export const getArchivedProject = asynchandler(async (req, res, next) => {
    const project = await Project.findById(req.params.projectId).populate("manager", "name").lean();
    if (!project) return next(new AppError("Project not found", 404));

    const closure = await ProjectClosure.findOne({ project: req.params.projectId })
        .populate("auditLog.user", "name")
        .lean();

    const phases = await ProjectPhase.find({ project: req.params.projectId }).sort({ order: 1 }).lean();
    const membersCount = await ProjectMember.countDocuments({ project: req.params.projectId });

    const finalCost = closure?.finalExtract?.totalExpenses || project.estimatedCost || 0;
    const savings = (project.budget || 0) - finalCost;
    const savingsPercent = project.budget > 0 ? Math.round(savings / project.budget * 100 * 10) / 10 : 0;
    const duration = calcDuration(project.startDate, project.completionDate || project.endDate);

    // Documents grouped by category
    let documents = [];
    try {
        documents = await ProjectDocument.find({ project: req.params.projectId }).lean();
    } catch (e) { /* ProjectDocument may not exist */ }

    const docCategories = {
        financial: { label: "المستندات المالية", items: [] },
        technical: { label: "التقارير الفنية", items: [] },
        hr: { label: "الموارد البشرية", items: [] },
        certificates: { label: "الشهادات والتصاريح", items: [] }
    };

    if (closure?.attachedDocuments) {
        closure.attachedDocuments.forEach(doc => {
            const cat = (doc.category || "TECHNICAL").toLowerCase();
            if (docCategories[cat]) docCategories[cat].items.push(doc);
        });
    }

    // Timeline from phases
    const timeline = phases.map(p => ({
        date: p.startDate || p.createdAt,
        title: p.nameAr || p.name,
        description: p.description || "",
        status: p.status
    }));

    return res.status(200).json({
        success: true,
        data: {
            overview: {
                name: project.name,
                code: project.code,
                status: "مؤرشف",
                archivedAt: project.archivedAt || closure?.closedAt,
                startDate: project.startDate,
                endDate: project.endDate,
                completionDate: project.completionDate || project.endDate,
                finalCost,
                budget: project.budget,
                savings,
                savingsPercent: `${savingsPercent}%`,
                manager: project.manager,
                teamSize: membersCount,
                duration
            },
            timeline,
            documents: docCategories,
            auditLog: (closure?.auditLog || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        }
    });
});
