import mongoose from "mongoose";

const reportTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            required: true,
            enum: ["PROJECTS", "HR", "INVENTORY", "PROCUREMENT", "FINANCIAL", "EQUIPMENT", "TICKETS"]
        },
        description: {
            type: String
        },
        // Saved filter criteria (e.g. date range, status, project, etc.)
        filters: {
            dateFrom: Date,
            dateTo: Date,
            status: [String],
            project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
            department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
            extraFilters: { type: Object }
        },
        // Which columns to include in the report
        columns: [{ type: String }],
        // Sort order
        sortBy: {
            field: { type: String },
            order: { type: String, enum: ["asc", "desc"], default: "desc" }
        },
        isPublic: {
            type: Boolean,
            default: false
            // If true, all users can see and run this template
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        lastRunAt: {
            type: Date
        },
        runCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

export default mongoose.model("ReportTemplate", reportTemplateSchema);
