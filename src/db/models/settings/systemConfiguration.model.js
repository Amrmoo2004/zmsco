import mongoose from "mongoose";

const systemConfigurationSchema = new mongoose.Schema(
    {
        companyName: {
            type: String,
            required: true,
        },
        registrationNumber: String,
        taxId: String,
        logoUrl: String,
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
        }
    },
    { timestamps: true }
);

export default mongoose.model("SystemConfiguration", systemConfigurationSchema);
