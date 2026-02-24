import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase",
            required: true
        },

        name: {
            type: String,
            required: true
        },

        description: String,

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        priority: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH"],
            default: "MEDIUM"
        },

        dueDate: Date,

        status: {
            type: String,
            enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "PENDING"
        },

        completedAt: Date
    },
    { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
