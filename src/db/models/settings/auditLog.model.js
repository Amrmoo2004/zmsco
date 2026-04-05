import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: [
                "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
                "APPROVE", "REJECT", "UPLOAD", "DOWNLOAD",
                "ASSIGN", "REVOKE", "EXPORT"
            ]
        },
        entity: {
            type: String,
            required: true
            // e.g. 'Project', 'User', 'Material', 'Role', etc.
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId
        },
        entityName: {
            type: String
            // human-readable label, e.g. project name
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        changes: {
            type: Object
            // { before: {...}, after: {...} }
        },
        description: {
            type: String
            // free-text summary
        },
        ip: {
            type: String
        },
        userAgent: {
            type: String
        },
        status: {
            type: String,
            enum: ["SUCCESS", "FAILED"],
            default: "SUCCESS"
        },
        errorMessage: {
            type: String
        }
    },
    { timestamps: true }
);

// Index for fast querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
