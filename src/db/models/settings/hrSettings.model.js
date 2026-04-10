import mongoose from "mongoose";

const hrSettingsSchema = new mongoose.Schema(
    {
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
    },
    { timestamps: true }
);

export default mongoose.model("HrSettings", hrSettingsSchema);
