import mongoose from "mongoose";

const systemConfigurationSchema = new mongoose.Schema(
    {
        companyNameAr: {
            type: String,
            required: true,
        },
        companyNameEn: {
            type: String,
            required: true,
        },
        registrationNumber: String,
        taxId: String,
        logoUrl: String,
        address: String,
        phoneNumber: String,
        email: String,
        website: String,
        defaultLanguage: {
            type: String,
            default: "ar",
        },
        financialYearStart: String,
        maintenanceMode: {
            type: Boolean,
            default: false,
        },
        autoBackup: {
            type: Boolean,
            default: false,
        },
        timezone: {
            type: String,
            default: "UTC",
        },
        dateFormat: {
            type: String,
            default: "YYYY-MM-DD",
        },
        currency: {
            type: String,
            default: "SAR",
        },
        inventorySettings: {
            lowStockAlerts: { type: Boolean, default: true },
            lowStockThreshold: { type: Number, default: 10 },
            expirationAlerts: { type: Boolean, default: true },
            expirationDaysWarning: { type: Number, default: 30 },
            batchTracking: { type: Boolean, default: false },
            serialNumberTracking: { type: Boolean, default: false },
            approvalOnIssuance: { type: Boolean, default: true },
            autoReorderPointCalculation: { type: Boolean, default: false }
        },
        hrSettings: {
            attendanceTracking: { type: Boolean, default: false },
            dailyWorkingHours: { type: Number, default: 8 },
            weeklyWorkingDays: { type: Number, default: 5 },
            overtimeRate: { type: Number, default: 1.5 },
            leaveManagement: { type: Boolean, default: false },
            annualLeaveDays: { type: Number, default: 21 },
            sickLeaveDays: { type: Number, default: 30 },
            directManagerApproval: { type: Boolean, default: false },
            performanceEvaluation: { type: Boolean, default: false },
            evaluationPeriodicity: { type: String, default: "quarterly" },
            sharedResourcePool: { type: Boolean, default: false }
        }
    },
    { timestamps: true }
);

export default mongoose.model("SystemConfiguration", systemConfigurationSchema);
