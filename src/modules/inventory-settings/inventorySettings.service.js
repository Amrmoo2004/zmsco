import MaterialCategory from "../../db/models/settings/materialCategory.model.js";
import MeasurementUnit from "../../db/models/settings/measurementUnit.model.js";
import InventoryConfig from "../../db/models/settings/inventoryConfig.model.js";
import InventoryModel from "../../db/models/inventory.js";
import Material from "../../db/models/metrials/📁 material.model.js";
import Notification from "../../db/models/notification.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// =====================================================================
// ─── INVENTORY CONFIG (Singleton) ────────────────────────────────────
// =====================================================================

/**
 * GET /api/inventory-settings/config
 * يجيب الإعدادات الحالية — ينشئها بالقيم الافتراضية لو مش موجودة
 */
export const getInventoryConfig = asynchandler(async (req, res) => {
  let config = await InventoryConfig.findOne();
  if (!config) {
    config = await InventoryConfig.create({});
  }
  return res.status(200).json({ success: true, data: config });
});

/**
 * PUT /api/inventory-settings/config
 * تحديث الإعدادات — ويطبق التغييرات فوراً على المنطق
 *
 * Body: {
 *   lowStockAlerts?: boolean,
 *   lowStockThreshold?: number,
 *   expiryAlerts?: boolean,
 *   expiryAlertDays?: number,
 *   batchTracking?: boolean,
 *   serialNumberTracking?: boolean,
 *   requireIssuanceApproval?: boolean
 * }
 */
export const updateInventoryConfig = asynchandler(async (req, res) => {
  let config = await InventoryConfig.findOne();

  if (!config) {
    config = await InventoryConfig.create(req.body);
  } else {
    const allowedFields = [
      "lowStockAlerts",
      "lowStockThreshold",
      "expiryAlerts",
      "expiryAlertDays",
      "batchTracking",
      "serialNumberTracking",
      "requireIssuanceApproval",
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });
    await config.save();
  }

  // ─── Side-Effects: طبّق التغييرات اللي ليها أثر فوري ────────────
  
  // 1. لو الحد الأدنى اتغير → ارسم تنبيهات للعناصر اللي اتجاوزت الحد الجديد
  if (req.body.lowStockThreshold !== undefined && config.lowStockAlerts) {
    const threshold = config.lowStockThreshold;
    const lowStockItems = await InventoryModel.find({ quantity: { $lte: threshold } })
      .populate("material", "name")
      .lean();

    if (lowStockItems.length > 0) {
      // إنشاء تنبيه واحد موجز (بدلاً من تنبيه لكل عنصر)
      await Notification.create({
        user: req.user._id,
        title: "تحديث حد المخزون الأدنى",
        body: `بناءً على الحد الجديد (${threshold} وحدة)، يوجد ${lowStockItems.length} صنف تحته الآن: ${lowStockItems.slice(0, 3).map((i) => i.material?.name || "مجهول").join("، ")}${lowStockItems.length > 3 ? "، وغيرها" : ""}`,
        type: "WARNING",
        data: { lowStockCount: lowStockItems.length, threshold },
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: "تم تحديث إعدادات المخزون بنجاح",
    data: config,
  });
});

/**
 * مساعد داخلي — يُستخدم من Dashboard وMaterial Requests
 * لجلب الإعدادات الحالية بدون الحاجة لـ req/res
 */
export const getActiveConfig = async () => {
  let config = await InventoryConfig.findOne().lean();
  if (!config) {
    // القيم الافتراضية لو لم يُنشأ السجل بعد
    config = {
      lowStockAlerts: true,
      lowStockThreshold: 10,
      expiryAlerts: true,
      expiryAlertDays: 30,
      batchTracking: false,
      serialNumberTracking: false,
      requireIssuanceApproval: false,
    };
  }
  return config;
};

// =====================================================================
// ─── MATERIAL CATEGORIES ─────────────────────────────────────────────
// =====================================================================

export const getCategories = asynchandler(async (req, res) => {
  const categories = await MaterialCategory.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: categories });
});

export const createCategory = asynchandler(async (req, res, next) => {
  const { nameAr, nameEn, code } = req.body;
  const existing = await MaterialCategory.findOne({ code });
  if (existing) return next(new AppError("Category code already exists", 400));
  const category = await MaterialCategory.create({ nameAr, nameEn, code });
  res.status(201).json({ success: true, message: "Category created", data: category });
});

export const updateCategory = asynchandler(async (req, res, next) => {
  const category = await MaterialCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) return next(new AppError("Category not found", 404));
  res.status(200).json({ success: true, message: "Category updated", data: category });
});

export const deleteCategory = asynchandler(async (req, res, next) => {
  const category = await MaterialCategory.findByIdAndDelete(req.params.id);
  if (!category) return next(new AppError("Category not found", 404));
  res.status(200).json({ success: true, message: "Category deleted" });
});

// =====================================================================
// ─── MEASUREMENT UNITS ───────────────────────────────────────────────
// =====================================================================

export const getUnits = asynchandler(async (req, res) => {
  const units = await MeasurementUnit.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: units });
});

export const createUnit = asynchandler(async (req, res, next) => {
  const { nameAr, nameEn, code, type } = req.body;
  const existing = await MeasurementUnit.findOne({ code });
  if (existing) return next(new AppError("Unit code already exists", 400));
  const unit = await MeasurementUnit.create({ nameAr, nameEn, code, type });
  res.status(201).json({ success: true, message: "Unit created", data: unit });
});

export const updateUnit = asynchandler(async (req, res, next) => {
  const unit = await MeasurementUnit.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!unit) return next(new AppError("Unit not found", 404));
  res.status(200).json({ success: true, message: "Unit updated", data: unit });
});

export const deleteUnit = asynchandler(async (req, res, next) => {
  const unit = await MeasurementUnit.findByIdAndDelete(req.params.id);
  if (!unit) return next(new AppError("Unit not found", 404));
  res.status(200).json({ success: true, message: "Unit deleted" });
});
