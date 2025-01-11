import B2 from 'backblaze-b2';

// Initialize B2 with credentials
const b2 = new B2({
    applicationKeyId: process.env.B2_APPLICATION_KEY_ID, // Using the key ID from .env
    applicationKey: process.env.B2_APPLICATION_KEY,      // Using the application key from .env
    accountId: process.env.B2_ACCOUNT_ID
});

class B2Storage {
    constructor() {
        // Default bucket name if not specified in environment
        this.bucketName = 'stickers-replicate-app';
        this.isAuthorized = false;
    }

    async authorize() {
        if (!this.isAuthorized) {
            try {
                console.log('Authorizing B2 with credentials:', {
                    keyId: process.env.B2_APPLICATION_KEY_ID,
                    accountId: process.env.B2_ACCOUNT_ID
                });
                await b2.authorize();
                this.isAuthorized = true;
                console.log('B2 authorization successful');
            } catch (error) {
                console.error('B2 authorization error:', error);
                throw new Error('Failed to authorize with B2: ' + error.message);
            }
        }
    }

    async uploadFile(fileBuffer, fileName, contentType = 'image/png') {
        try {
            await this.authorize();
            
            console.log('Listing buckets...');
            const { data: { buckets } } = await b2.listBuckets();
            console.log('Available buckets:', buckets.map(b => b.bucketName));
            
            const bucket = buckets.find(b => b.bucketName === this.bucketName);
            if (!bucket) {
                console.error('Available buckets:', buckets.map(b => b.bucketName));
                throw new Error(`Bucket "${this.bucketName}" not found. Available buckets: ${buckets.map(b => b.bucketName).join(', ')}`);
            }

            console.log('Getting upload URL for bucket:', bucket.bucketName);
            const { data: uploadUrl } = await b2.getUploadUrl({
                bucketId: bucket.bucketId
            });

            console.log('Uploading file:', fileName);
            const { data } = await b2.uploadFile({
                uploadUrl: uploadUrl.uploadUrl,
                uploadAuthToken: uploadUrl.authorizationToken,
                fileName: fileName,
                data: fileBuffer,
                contentType: contentType
            });

            const fileUrl = `https://f004.backblazeb2.com/file/${this.bucketName}/${fileName}`;
            console.log('File uploaded successfully:', fileUrl);
            return fileUrl;
        } catch (error) {
            console.error('Error uploading to B2:', error);
            throw new Error('Failed to upload file to B2: ' + error.message);
        }
    }

    async deleteFile(fileName) {
        try {
            await this.authorize();
            
            console.log('Looking up file for deletion:', fileName);
            const { data: { buckets } } = await b2.listBuckets();
            const bucket = buckets.find(b => b.bucketName === this.bucketName);
            
            if (!bucket) {
                throw new Error(`Bucket "${this.bucketName}" not found`);
            }

            const { data: { files } } = await b2.listFileNames({
                bucketId: bucket.bucketId,
                startFileName: fileName,
                maxFileCount: 1
            });

            const file = files.find(f => f.fileName === fileName);
            if (!file) {
                console.log('File not found for deletion:', fileName);
                return true; // File doesn't exist, consider it deleted
            }

            console.log('Deleting file:', fileName);
            await b2.deleteFileVersion({
                fileId: file.fileId,
                fileName: fileName
            });
            console.log('File deleted successfully:', fileName);

            return true;
        } catch (error) {
            console.error('Error deleting from B2:', error);
            throw new Error('Failed to delete file from B2: ' + error.message);
        }
    }
}

// Export a singleton instance
export const b2Storage = new B2Storage();
