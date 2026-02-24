import SystemConfiguration from "../../db/models/settings/systemConfiguration.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getConfig = asynchandler(async (req, res) => {
    // There is only one config document (singleton)
    let config = await SystemConfiguration.findOne();
    if (!config) config = await SystemConfiguration.create({ companyName: "My Company" });
    return res.status(200).json({ success: true, data: config });
});

export const updateConfig = asynchandler(async (req, res, next) => {
    let config = await SystemConfiguration.findOne();
    if (!config) {
        config = await SystemConfiguration.create(req.body);
    } else {
        Object.assign(config, req.body);
        await config.save();
    }
    return res.status(200).json({ success: true, message: "Configuration updated successfully", data: config });
});
