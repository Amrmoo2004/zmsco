import Supplier from "../../db/models/procurement/supplier.model.js";
import PurchaseOrder from "../../db/models/procurement/purchaseOrder.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all suppliers
 */
export const getAllSuppliers = asynchandler(async (req, res, next) => {
    const { search } = req.query;

    const query = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { contactPerson: { $regex: search, $options: "i" } }
        ];
    }

    const suppliers = await Supplier.find(query)
        .populate("materials", "name unit")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: suppliers
    });
});

/**
 * Get supplier by ID
 */
export const getSupplierById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const supplier = await Supplier.findById(id)
        .populate("materials", "name unit");

    if (!supplier) {
        return next(new AppError("Supplier not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: supplier
    });
});

/**
 * Create new supplier
 */
export const createSupplier = asynchandler(async (req, res, next) => {
    const { name, contactPerson, phone, email, address, materials } = req.body;

    // Check if supplier with same name exists
    const existingSupplier = await Supplier.findOne({ name });
    if (existingSupplier) {
        return next(new AppError("Supplier with this name already exists", 400));
    }

    const supplier = await Supplier.create({
        name,
        contactPerson,
        phone,
        email,
        address,
        materials
    });

    await supplier.populate("materials", "name unit");

    return res.status(201).json({
        success: true,
        message: "Supplier created successfully",
        data: supplier
    });
});

/**
 * Update supplier
 */
export const updateSupplier = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, contactPerson, phone, email, address, materials } = req.body;

    const supplier = await Supplier.findById(id);

    if (!supplier) {
        return next(new AppError("Supplier not found", 404));
    }

    // Check if new name conflicts
    if (name && name !== supplier.name) {
        const existingSupplier = await Supplier.findOne({ name });
        if (existingSupplier) {
            return next(new AppError("Supplier with this name already exists", 400));
        }
    }

    if (name) supplier.name = name;
    if (contactPerson) supplier.contactPerson = contactPerson;
    if (phone) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (address !== undefined) supplier.address = address;
    if (materials) supplier.materials = materials;

    await supplier.save();
    await supplier.populate("materials", "name unit");

    return res.status(200).json({
        success: true,
        message: "Supplier updated successfully",
        data: supplier
    });
});

/**
 * Delete supplier
 */
export const deleteSupplier = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);

    if (!supplier) {
        return next(new AppError("Supplier not found", 404));
    }

    // Check if supplier has purchase orders
    const orderCount = await PurchaseOrder.countDocuments({ supplier: id });
    if (orderCount > 0) {
        return next(new AppError("Cannot delete supplier with existing purchase orders", 400));
    }

    await supplier.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Supplier deleted successfully"
    });
});

/**
 * Get supplier purchase orders
 */
export const getSupplierOrders = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        return next(new AppError("Supplier not found", 404));
    }

    const orders = await PurchaseOrder.find({ supplier: id })
        .populate("items.material", "name unit")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: {
            supplier: {
                id: supplier._id,
                name: supplier.name,
                contactPerson: supplier.contactPerson
            },
            orders
        }
    });
});
