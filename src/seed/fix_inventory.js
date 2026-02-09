import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.URL_DATABASE);
        console.log("🔌 Connected to DB");

        // Try to drop the collection to clear old data and indexes (E11000)
        try {
            await mongoose.connection.collection("inventories").drop();
            console.log("✅ Dropped 'inventories' collection (Cleared old Schema/Indexes).");
        } catch (error) {
            if (error.code === 26) {
                console.log("ℹ️ Collection 'inventories' does not exist (Skipped).");
            } else {
                console.error("❌ Error dropping collection:", error.message);
            }
        }

        console.log("✨ Ready for new seed!");
        process.exit(0);
    } catch (err) {
        console.error("❌ DB Connection Error:", err);
        process.exit(1);
    }
};

run();
