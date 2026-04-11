import eventBus from './index.js';
import Material from '../db/models/metrials/metrials.js';
import Supplier from '../db/models/procurement/supplier.model.js';
import Role from '../db/models/roles.js';
import User from '../db/models/user.js';
import Notification from '../db/models/notification.model.js';

eventBus.on('INVENTORY_UPDATED', async (payload) => {
    try {
        const { materialId, currentQuantity, warehouseId } = payload;
        
        // 1. Fetch material to check minStock
        const material = await Material.findById(materialId);
        if (!material || !material.minStock) return;

        // 2. Check if the stock has fallen below the minimum threshold
        if (currentQuantity <= material.minStock) {
            
            // 3. Find suppliers that provide this material
            const suppliers = await Supplier.find({ materials: materialId }).select('name contactPerson phone email');
            
            // 4. Find all users who manage procurement / suppliers
            const procurementRoles = await Role.find({ 
                permissions: { $in: ["MANAGE_SUPPLIERS", "CREATE_PURCHASE_ORDER", "MANAGE_NOTIFICATIONS"] } 
            });
            const roleIds = procurementRoles.map(r => r._id);
            const procurementUsers = await User.find({ role: { $in: roleIds } });

            if (procurementUsers.length === 0) {
                console.log(`⚠️ [EventBus] Low stock for ${material.name}, but no procurement users found to notify.`);
                return;
            }

            // 5. Create notifications for each procurement user
            const notifications = procurementUsers.map(user => ({
                user: user._id,
                title: "تنبيه نقص مخزون (Low Stock Alert)",
                body: `لقد انخفض رصيد المادة (${material.name}) إلى ${currentQuantity} (الحد الأدنى: ${material.minStock}). برجاء مراجعة الموردين وإصدار أمر شراء.`,
                type: "WARNING",
                data: {
                    materialId: material._id,
                    materialName: material.name,
                    currentQuantity,
                    minStock: material.minStock,
                    warehouseId,
                    availableSuppliers: suppliers
                }
            }));

            await Notification.insertMany(notifications);
            console.log(`✅ [EventBus] Low stock alert created for ${material.name} and sent to ${procurementUsers.length} users.`);
        }
    } catch (error) {
        console.error('🔥 [EventBus / INVENTORY_UPDATED] Error processing event:', error);
    }
});
