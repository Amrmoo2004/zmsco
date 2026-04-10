import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Material from './src/db/models/metrials/metrials.js';

mongoose.connect(process.env.URL_DATABASE).then(async () => {
    try {
        const materials = await Material.find();
        let deletedCount = 0;
        for (const mat of materials) {
            // Check if unit or category is not valid ObjectIds, or stored as strings!
            // In JS, mongoose gets them as subdocuments or ids depending on schema.
            // If they are corrupted, Mongoose will throw a CastError upon querying, 
            // but `find()` without populate might return them.
        }

        // Just delete the ones that have string data where object id should be.
        const res1 = await Material.deleteMany({ unit: { $type: "string" } });
        const res2 = await Material.deleteMany({ category: { $type: "string" } });
        console.log('Deleted corrupted materials with string identifiers:', res1.deletedCount + res2.deletedCount);
    } catch (e) {
        console.log(e);
    } finally {
        process.exit(0);
    }
}).catch(console.error);
