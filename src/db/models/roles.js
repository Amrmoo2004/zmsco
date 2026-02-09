import mongoose from "mongoose";
const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },

  permissions: {
    type: [String],
    default: []
  }, 
   isDefault: {
      type: Boolean,
      default: false
    },

  isActive: {
    type: Boolean,
    default: true
  } 

}
, { timestamps: true }
);

export default mongoose.model("Role", roleSchema);


