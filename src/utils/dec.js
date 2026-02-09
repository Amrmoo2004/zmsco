import CryptoJS from "crypto-js";
 export const decrypt = (ciphertext, secretKey=process.env.encryption_key) => {
        if (!ciphertext || !secretKey) {
            throw new Error("Both ciphertext and secret key are required for decryption");
        }
        const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    };