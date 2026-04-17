import mongoose from "mongoose";

/**
 * InventoryConfig — Singleton (يوجد مستند واحد فقط في الـ DB)
 * يحتوي على جميع إعدادات المخزون الظاهرة في صفحة "إعدادات المخزون"
 */
const inventoryConfigSchema = new mongoose.Schema(
  {
    // ─── تنبيهات نفاذ المخزون ─────────────────────────────────────
    lowStockAlerts: {
      type: Boolean,
      default: true,
    },
    // الحد الأدنى للكمية — إذا كانت الكمية أقل من هذا الرقم يرسل تنبيه
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    // ─── تنبيهات انتهاء الصلاحية ─────────────────────────────────
    expiryAlerts: {
      type: Boolean,
      default: true,
    },
    // كم يوم قبل انتهاء الصلاحية يرسل التنبيه
    expiryAlertDays: {
      type: Number,
      default: 30,
      min: 1,
    },

    // ─── تتبع الدفعات (Batch Tracking) ───────────────────────────
    batchTracking: {
      type: Boolean,
      default: false,
    },

    // ─── تتبع الأرقام التسلسلية ───────────────────────────────────
    serialNumberTracking: {
      type: Boolean,
      default: false,
    },

    // ─── الموافقة على الصرف ───────────────────────────────────────
    // إذا true → طلبات الصرف تحتاج موافقة قبل تنفيذها
    requireIssuanceApproval: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryConfig", inventoryConfigSchema);
