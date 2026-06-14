import mongoose from "mongoose";
import * as dotenv from 'dotenv';

dotenv.config({});

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export const connectDB = async () => {
    const dbUrl = process.env.URL_DATABASE;
    const isProduction = process.env.NODE_ENV === "production";

    const options = {
        maxPoolSize: 20,       // Maximum concurrent connections
        minPoolSize: 5,        // Minimum connections kept alive
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 10000,
        autoIndex: !isProduction, // Disable auto-index in production for faster startup
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(dbUrl, options);
            console.log("🚀 Database connected successfully");
            console.log(`   Pool: min=${options.minPoolSize} max=${options.maxPoolSize} | autoIndex=${options.autoIndex}`);
            return;
        } catch (error) {
            console.error(`🚨 Database connection attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);

            if (attempt === MAX_RETRIES) {
                console.error("🚨 All database connection attempts exhausted. Exiting.");
                process.exit(1);
            }

            console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};