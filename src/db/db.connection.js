import mongoose from "mongoose";
import * as dotenv from 'dotenv';

dotenv.config({  });

export const connectDB =async () => {
    const dbUrl = process.env.URL_DATABASE

    try {
           await mongoose.connect(dbUrl)
        console.log("🚀 Database connected successfully");
    } catch (error) {
        console.error("🚨 Database connection failed:", error);
    }

};