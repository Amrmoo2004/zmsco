import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Inventory from "../../db/models/inventory.js";
import ProjectMaterial from "../../db/models/metrials/📁 projectMaterial.model.js";
import mongoose from "mongoose";
export const create_request = async ({
  project,
  items,
  userId
}) => {
  return await MaterialRequest.create({
    project,
    items,
    requestedBy: userId
  });
};

export const approve_request = async (requestId, userId) => {
  const request = await MaterialRequest.findById(requestId);

  if (!request || request.status !== "PENDING") {
    throw new Error("Invalid request");
  }

  request.status = "APPROVED";
  request.approvedBy = userId;
  await request.save();

  return request;
};

export const issue_request = async (requestId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await MaterialRequest.findById(requestId)
      .populate("items.material")
      .session(session);

    if (!request || request.status !== "APPROVED") {
      throw new Error("Invalid request");
    }

    for (const item of request.items) {
      const inventory = await Inventory.findOne({
        material: item.material._id
      }).session(session);

      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.material.name}`);
      }

      // 1️⃣ deduct inventory
      inventory.quantity -= item.quantity;
      inventory.lastUpdated = new Date();
      await inventory.save({ session });

      // 2️⃣ transaction record
      const unitCost =
        item.material.suppliers?.[0]?.price || 0;

      const totalCost = unitCost * item.quantity;

      await MaterialTransaction.create(
        [
          {
            project: request.project,
            material: item.material._id,
            quantity: item.quantity,
            type: "ISSUE",
            unitCost,
            totalCost,
            referenceRequest: request._id,
            createdBy: userId
          }
        ],
        { session }
      );

      // 3️⃣ update project material
      await ProjectMaterial.findOneAndUpdate(
        {
          project: request.project,
          material: item.material._id
        },
        {
          $inc: {
            issuedQuantity: item.quantity,
            totalCost: totalCost
          }
        },
        { session }
      );
    }

    // 4️⃣ update request
    request.status = "ISSUED";
    request.issuedBy = userId;
    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    return request;

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
