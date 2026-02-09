import mongoose from "mongoose";

const blacklistTokenSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: '0' } // TTL index: automatically delete after this date
        }
    },
    { timestamps: true }
);

const BlacklistToken = mongoose.model("BlacklistToken", blacklistTokenSchema);

export default BlacklistToken;
