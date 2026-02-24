import mongoose from "mongoose";

const workLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase"
        },
        date: {
            type: Date,
            required: true
        },
        hoursLogged: {
            type: Number,
            required: true,
            min: 0,
            max: 24
        },
        description: String,
        cost: {
            type: Number,
            default: 0 // calculated: hoursLogged * user.hourlyRate
        }
    },
    { timestamps: true }
);

export default mongoose.model("WorkLog", workLogSchema);
