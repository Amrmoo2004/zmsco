import HrSettings from "../../db/models/settings/hrSettings.model.js";
import { asynchandler } from "../../utils/response/response.js";

export const getHrSettings = asynchandler(async (req, res) => {
    let settings = await HrSettings.findOne();
    if (!settings) settings = await HrSettings.create({});
    return res.status(200).json({ success: true, data: settings });
});

export const updateHrSettings = asynchandler(async (req, res, next) => {
    let settings = await HrSettings.findOne();
    if (!settings) {
        settings = await HrSettings.create(req.body);
    } else {
        Object.assign(settings, req.body);
        await settings.save();
    }
    return res.status(200).json({ success: true, message: "HR settings updated successfully", data: settings });
});
