import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export async function sendemails({
    from = process.env.app_email,
    to = "",
    cc = "",
    bcc = "",
    text = "",
    html = "",
    subject = "ZMSCO",
    attachments = []
} = {}) {

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.app_email,
            pass: process.env.app_password,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"ZMSCO" <${process.env.app_email}>`,
            to, cc, bcc, text, html, subject, attachments
        });

        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}