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
        registrationNumber: {
            type: String,
            required: true,
        },
        taxId: {
            type: String,
            required: true,
        },
        logoUrl: String,
        address: {
            type: String,
            required: true,
        },
        phoneNumber: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        website: String,
        defaultLanguage: {
            type: String,
            default: "ar",
            required: true,
        },
        financialYearStart: {
            type: String,
            required: true,
        },
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
            default: "Asia/Riyadh",
            required: true,
        },
        dateFormat: {
            type: String,
            default: "YYYY-MM-DD",
            required: true,
        },
        currency: {
            type: String,
            default: "SAR",
            required: true,
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
        }
    },
    { timestamps: true }
);

export default mongoose.model("SystemConfiguration", systemConfigurationSchema);
