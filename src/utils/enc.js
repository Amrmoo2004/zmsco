import CryptoJS from "crypto-js";
   export const encrypt = (text, secretKey) => {
        if (!text || !secretKey) {
            throw new Error("Both text and secret key are required for encryption");
        }
        return CryptoJS.AES.encrypt(text, process.env.encryption_key).toString();
    };
   