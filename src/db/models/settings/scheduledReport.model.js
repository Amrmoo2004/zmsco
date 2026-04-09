import mongoose from "mongoose";

const scheduledReportSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String // e.g. "يُرسل في اليوم الأول من كل شهر..."
        },
        periodicity: {
            type: String,
            required: true,
            enum: ["يومي", "أسبوعي", "شهري"]
        },
        format: {
            type: String,
            enum: ["PDF", "Excel"],
            default: "PDF"
        },
        recipients: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        isActive: {
            type: Boolean,
            default: true
        },
        reportTemplate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ReportTemplate"
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("ScheduledReport", scheduledReportSchema);
