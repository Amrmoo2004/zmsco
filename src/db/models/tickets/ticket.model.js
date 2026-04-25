import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
    {
        // Auto-generated: REQ-YYYY-NNN
        requestId: {
            type: String,
            unique: true
        },

        // نوع الطلب — matches UI dropdown
        type: {
            type: String,
            required: true,
            enum: ["MAINTENANCE", "SUPPORT", "INSPECTION", "OTHER"]
        },

        // المشروع
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },

        // مرحلة المشروع
        projectPhase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase"
        },

        // المعدة / الجهاز
        equipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment"
        },

        // وصف المشكلة
        description: {
            type: String,
            required: true
        },

        // ملاحظات المراجعة (يظهر في صفحة التفاصيل)
        reviewNotes: {
            type: String,
            default: ""
        },

        // الأولوية
        priority: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            default: "MEDIUM"
        },

        // تاريخ الإنجاز المطلوب
        targetDate: Date,

        // حالة الطلب (workflow)
        status: {
            type: String,
            enum: ["NEW", "UNDER_REVIEW", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED"],
            default: "NEW"
        },

        // مقدم الطلب
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // الفريق المعين
        assignedTeam: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        // سبب الرفض
        rejectionReason: {
            type: String,
            default: ""
        },

        // المرفقات (Cloudinary)
        attachments: [
            {
                url: { type: String, required: true },
                publicId: { type: String, required: true },
                originalName: { type: String },
                mimeType: { type: String },
                uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
            }
        ],

        // تاريخ تغييرات الحالة
        history: [
            {
                status: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                timestamp: { type: Date, default: Date.now },
                notes: String
            }
        ],

        // التعليقات
        comments: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                text: { type: String, required: true },
                createdAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

// Auto-generate requestId: REQ-YYYY-NNN
ticketSchema.pre("save", async function () {
    if (!this.requestId) {
        const year = new Date().getFullYear();
        const count = await mongoose.model("Ticket").countDocuments();
        this.requestId = `REQ-${year}-${String(count + 1).padStart(3, "0")}`;
    }
});

export default mongoose.model("Ticket", ticketSchema);
