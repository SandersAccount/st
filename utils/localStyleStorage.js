import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalStyleStorage {
    constructor() {
        this.uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'styles');
        this.ensureUploadsDirectory();
    }

    ensureUploadsDirectory() {
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    async saveImage(imageBuffer, originalName) {
        const fileName = `${Date.now()}-${originalName}`;
        const filePath = path.join(this.uploadsDir, fileName);
        
        await fs.promises.writeFile(filePath, imageBuffer);
        
        // Return the URL path that can be used to access the image
        return `/uploads/styles/${fileName}`;
    }

    async deleteImage(imageUrl) {
        try {
            const fileName = path.basename(imageUrl);
            const filePath = path.join(this.uploadsDir, fileName);
            
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
            return true;
        } catch (error) {
            console.error('Error deleting image:', error);
            return false;
        }
    }
}

// Export a singleton instance
export const localStyleStorage = new LocalStyleStorage();
