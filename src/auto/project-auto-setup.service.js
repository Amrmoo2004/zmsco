import ProjectTemplate from "../db/models/projects/project.template.js";
import ProjectPhase from "../db/models/projects/project.phase.js";
import ProjectMaterial from "../db/models/metrials/📁 projectMaterial.model.js";
import ProjectEquipment from "../db/models/projects/project.equipment.js";
import Material from "../db/models/metrials/metrials.js";
import ProjectDocument from "../db/models/projects/project.document.js";
import ProjectMember from "../db/models/projects/project.member.js";

export const autoSetupProject = async (project) => {

  // 1️⃣ get template
  const template = await ProjectTemplate.findOne({
    type: project.type,
    isActive: true
  });

  if (!template) return;

  // 2️⃣ create phases
  for (const phase of template.phases) {
    await ProjectPhase.create({
      project: project._id,
      name: phase.name,
      order: phase.order
    });
  }

  // 3️⃣ default materials
  for (const mat of template.materials) {

    const material = await Material.findOne({
      name: mat.name
    });

    if (!material) continue;

    await ProjectMaterial.create({
      project: project._id,
      material: material._id,
      plannedQuantity: mat.defaultQuantity
    });
  }


  // 4️⃣ equipment
  for (const eq of template.equipments) {
    await ProjectEquipment.create({
      project: project._id,
      name: eq.name,
      count: eq.defaultQuantity
    });
  }

  // 5️⃣ documents
  for (const doc of template.attachments) {
    await ProjectDocument.create({
      project: project._id,
      name: doc.name,
      status: "PENDING",
      isRequired: doc.required
    });
  }

  // 6️⃣ team members
  for (const emp of template.employees) {
    await ProjectMember.create({
      project: project._id,
      role: emp.role,
      count: emp.defaultCount,
      systemRole: emp.systemRole,
      status: "VACANT"
    });
  }
};

