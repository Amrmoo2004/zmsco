import { Router } from "express";
import { auth } from "../../middlewares/auth.js";

const router = Router();

const TEMPLATE_VARIABLES = {
    general: [
        { name: "التاريخ الحالي", key: "{{current_date}}" },
        { name: "إسم المستخدم", key: "{{user_name}}" }
    ],
    project: [
        { name: "اسم المشروع", key: "{{project_name}}" },
        { name: "كود المشروع", key: "{{project_code}}" },
        { name: "تاريخ الإنجاز", key: "{{completion_date}}" },
        { name: "اسم المدير", key: "{{manager_name}}" }
    ],
    financial: [
        { name: "الميزانية الإجمالية", key: "{{total_budget}}" },
        { name: "إجمالي المصروفات", key: "{{total_expenses}}" }
    ]
};

/**
 * @swagger
 * /template-variables:
 *   get:
 *     summary: Get available variables for templates integration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of available variables grouped by category }
 */
router.get("/", auth, (req, res) => {
    return res.status(200).json({ success: true, data: TEMPLATE_VARIABLES });
});

export default router;
