import fetch from 'node-fetch';
import B2 from 'backblaze-b2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize B2 with required options
const b2 = new B2({
    applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const BUCKET_NAME = 'stickers-replicate-app';
const BUCKET_ID = 'a2338a969ede490f92410d1d';
let authData = null;

async function ensureAuthorized() {
    try {
        if (!authData) {
            console.log('Starting B2 authorization...');
            
            if (!process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
                throw new Error('B2 credentials not found in environment variables');
            }

            authData = await b2.authorize();
            console.log('B2 authorization successful');
        }
        return authData;
    } catch (error) {
        console.error('B2 authorization failed:', {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
}

/**
 * Downloads and saves an image from a URL
 * @param {string} imageUrl - The URL of the image to download
 * @param {boolean} isUpscaled - Whether this is an upscaled image
 * @returns {Promise<{filePath: string, fileName: string, publicUrl: string}>} The path where the image was saved
 */
export async function saveImageFromUrl(imageUrl, isUpscaled = false) {
    try {
        // First ensure we're authorized
        const auth = await ensureAuthorized();
        
        console.log('Downloading image from:', imageUrl);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error('Failed to fetch image:', {
                status: response.status,
                statusText: response.statusText,
                url: imageUrl
            });
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        console.log('Image downloaded, size:', buffer.byteLength);

        if (buffer.byteLength === 0) {
            throw new Error('Downloaded image is empty');
        }
        
        // Create a unique filename with appropriate folder prefix
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const filename = isUpscaled ? 
            `upscaled/${timestamp}-${randomString}.png` : 
            `${timestamp}-${randomString}.png`;
        
        // Get upload URL using known bucket ID
        console.log('Getting upload URL...');
        const { data: uploadUrl } = await b2.getUploadUrl({
            bucketId: BUCKET_ID
        });

        if (!uploadUrl || !uploadUrl.uploadUrl || !uploadUrl.authorizationToken) {
            console.error('Invalid upload URL response:', uploadUrl);
            throw new Error('Failed to get upload URL from B2');
        }
        
        console.log('Uploading file to B2...');
        const uploadResult = await b2.uploadFile({
            uploadUrl: uploadUrl.uploadUrl,
            uploadAuthToken: uploadUrl.authorizationToken,
            fileName: filename,
            data: Buffer.from(buffer),
            contentType: 'image/png',
            onUploadProgress: (event) => {
                console.log('Upload progress:', Math.round((event.loaded * 100) / event.total) + '%');
            }
        });

        if (!uploadResult.data || !uploadResult.data.fileName) {
            console.error('Invalid upload result:', uploadResult);
            throw new Error('Failed to upload file to B2');
        }
        
        console.log('File uploaded successfully:', uploadResult.data.fileName);
        
        // Construct the public URL using the bucket name and region
        const publicUrl = `https://f005.backblazeb2.com/file/${BUCKET_NAME}/${filename}`;
        console.log('Generated public URL:', publicUrl);
        
        return {
            fileName: filename,
            publicUrl: publicUrl
        };
    } catch (error) {
        console.error('Error in saveImageFromUrl:', {
            message: error.message,
            stack: error.stack,
            details: error.response?.data || error
        });
        throw error;
    }
}

/**
 * Deletes an image from storage
 * @param {string} fileName - Name of the file to delete
 */
export async function deleteImage(fileName) {
    try {
        const auth = await ensureAuthorized();
        
        console.log('Getting file info...');
        const { data: files } = await b2.listFileNames({
            bucketId: BUCKET_ID,
            startFileName: fileName,
            maxFileCount: 1
        });

        if (files.files.length > 0 && files.files[0].fileName === fileName) {
            console.log('Deleting file from B2...');
            await b2.deleteFileVersion({
                fileId: files.files[0].fileId,
                fileName: fileName
            });
            console.log('File deleted successfully');
        } else {
            console.log('File not found:', fileName);
        }
    } catch (error) {
        console.error('Error in deleteImage:', {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
}

/**
 * Gets the public URL for an image with a download authorization token
 * @param {string} fileName - The name of the image file
 * @returns {Promise<string>} The public URL for the image
 */
export async function getImagePublicUrl(fileName) {
    try {
        const auth = await ensureAuthorized();
        
        // Get a download authorization token
        const downloadAuth = await b2.getDownloadAuthorization({
            bucketId: BUCKET_ID,
            fileNamePrefix: fileName,
            validDurationInSeconds: 604800 // 7 days
        });

        // Construct the URL with the authorization token
        return `${auth.data.downloadUrl}/file/${BUCKET_NAME}/${fileName}?Authorization=${downloadAuth.data.authorizationToken}`;
    } catch (error) {
        console.error('Error getting image public URL:', {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
}
