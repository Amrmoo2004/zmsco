import { EventEmitter } from "node:events";
import { sendemails } from "../emails/nodemailer.js"; 

export const emailevnt = new EventEmitter();
emailevnt.on("confirmemail", async (data) => {
  await sendemails({
    to: data.to,
    subject: `Your Verification Code: ${data.otp}`,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .otp-code { 
            font-size: 24px; 
            letter-spacing: 3px; 
            color: #e74c3c;
            margin: 20px 0;
            padding: 10px;
            background: #f9f9f9;
            display: inline-block;
        }
        .footer { margin-top: 20px; font-size: 12px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">Hi ${data.username},</h1>
        <p>Here's your verification code:</p>
        <div class="otp-code">${data.otp}</div>
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ZMSCO. All rights reserved.</p>
            <p></p>
        </div>
    </div>
</body>
</html>
    `
  });
});
emailevnt.on("forgotpassword", async (data) => {
  await sendemails({
    to: data.to,
    subject: `Your forgot password OTP`,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .otp-code { 
            font-size: 24px; 
            letter-spacing: 3px; 
            color: #e74c3c;
            margin: 20px 0;
            padding: 10px;
            background: #f9f9f9;
            display: inline-block;
        }
        .footer { margin-top: 20px; font-size: 12px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="header">Hi ,</h1>
        <p>Here's your verification code:</p>
        <div class="otp-code">${data.otp}</div>
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ZMSCO. All rights reserved.</p>
            <p></p>
        </div>
    </div>
</body>
</html>
    `
  });
});