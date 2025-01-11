const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { createCanvas, loadImage } = require('canvas');
const Collection = require('../models/Collection');

class ExportService {
    async exportToZip(collectionId, options = {}) {
        const collection = await Collection.findById(collectionId)
            .populate('images')
            .populate('tags');

        if (!collection) {
            throw new Error('Collection not found');
        }

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        // Create write stream
        const outputPath = path.join(process.env.TEMP_DIR, `${collection._id}.zip`);
        const output = fs.createWriteStream(outputPath);

        return new Promise((resolve, reject) => {
            output.on('close', () => resolve(outputPath));
            archive.on('error', reject);

            archive.pipe(output);

            // Add images to zip
            collection.images.forEach((image, index) => {
                const extension = this._getImageExtension(image.url);
                const filename = `images/${index + 1}${extension}`;
                
                // Convert base64 to buffer if needed
                const imageData = image.url.includes('base64') 
                    ? Buffer.from(image.url.split(',')[1], 'base64')
                    : image.url;

                archive.append(imageData, { name: filename });
            });

            // Add metadata
            const metadata = {
                title: collection.title,
                description: collection.description,
                createdAt: collection.createdAt,
                images: collection.images.map(image => ({
                    filename: image.url.split('/').pop(),
                    prompt: image.prompt,
                    tags: image.tags.map(tag => tag.name),
                    metadata: image.metadata
                }))
            };

            archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

            archive.finalize();
        });
    }

    async exportToPDF(collectionId, options = {}) {
        const collection = await Collection.findById(collectionId)
            .populate('images')
            .populate('tags');

        if (!collection) {
            throw new Error('Collection not found');
        }

        const doc = new PDFDocument({
            autoFirstPage: false,
            size: options.size || 'A4'
        });

        const outputPath = path.join(process.env.TEMP_DIR, `${collection._id}.pdf`);
        const output = fs.createWriteStream(outputPath);

        return new Promise(async (resolve, reject) => {
            doc.pipe(output);

            // Add cover page
            doc.addPage();
            doc.font('Helvetica-Bold')
                .fontSize(24)
                .text(collection.title, { align: 'center' });
            
            if (collection.description) {
                doc.moveDown()
                    .font('Helvetica')
                    .fontSize(12)
                    .text(collection.description, { align: 'center' });
            }

            // Add images
            for (const image of collection.images) {
                doc.addPage();

                // Add image
                const imgBuffer = image.url.includes('base64')
                    ? Buffer.from(image.url.split(',')[1], 'base64')
                    : image.url;

                const dimensions = this._fitImageToPDF(
                    image.metadata.width,
                    image.metadata.height,
                    doc.page.width - 100,
                    doc.page.height - 200
                );

                doc.image(imgBuffer, {
                    fit: [dimensions.width, dimensions.height],
                    align: 'center',
                    valign: 'center'
                });

                // Add metadata
                doc.moveDown()
                    .fontSize(10)
                    .text(`Prompt: ${image.prompt || 'N/A'}`, { align: 'left' })
                    .text(`Tags: ${image.tags.map(t => t.name).join(', ') || 'N/A'}`);
            }

            doc.end();
            output.on('finish', () => resolve(outputPath));
            output.on('error', reject);
        });
    }

    async exportToExcel(collectionId) {
        const collection = await Collection.findById(collectionId)
            .populate('images')
            .populate('tags');

        if (!collection) {
            throw new Error('Collection not found');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Images');

        // Add headers
        worksheet.columns = [
            { header: 'Image ID', key: 'id', width: 30 },
            { header: 'Prompt', key: 'prompt', width: 50 },
            { header: 'Tags', key: 'tags', width: 30 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Dimensions', key: 'dimensions', width: 15 }
        ];

        // Add data
        collection.images.forEach(image => {
            worksheet.addRow({
                id: image._id.toString(),
                prompt: image.prompt || '',
                tags: image.tags.map(t => t.name).join(', '),
                category: image.category,
                createdAt: image.createdAt.toISOString(),
                size: this._formatFileSize(image.metadata?.size),
                dimensions: `${image.metadata?.width}x${image.metadata?.height}`
            });
        });

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const outputPath = path.join(process.env.TEMP_DIR, `${collection._id}.xlsx`);
        await workbook.xlsx.writeFile(outputPath);
        return outputPath;
    }

    async createContactSheet(collectionId, options = {}) {
        const {
            columns = 5,
            spacing = 20,
            titleHeight = 30,
            imageSize = 200
        } = options;

        const collection = await Collection.findById(collectionId)
            .populate('images');

        if (!collection) {
            throw new Error('Collection not found');
        }

        const rows = Math.ceil(collection.images.length / columns);
        const canvas = createCanvas(
            columns * (imageSize + spacing) + spacing,
            rows * (imageSize + spacing + titleHeight) + spacing
        );
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw images
        for (let i = 0; i < collection.images.length; i++) {
            const image = collection.images[i];
            const row = Math.floor(i / columns);
            const col = i % columns;
            const x = spacing + col * (imageSize + spacing);
            const y = spacing + row * (imageSize + spacing + titleHeight);

            // Draw image
            const img = await loadImage(image.url);
            ctx.drawImage(img, x, y, imageSize, imageSize);

            // Draw title
            ctx.font = '12px Arial';
            ctx.fillStyle = '#000000';
            ctx.fillText(
                image.prompt || `Image ${i + 1}`,
                x,
                y + imageSize + 20,
                imageSize
            );
        }

        return canvas.toBuffer();
    }

    _getImageExtension(url) {
        if (url.includes('base64')) {
            const mime = url.split(';')[0].split(':')[1];
            return `.${mime.split('/')[1]}`;
        }
        return path.extname(url);
    }

    _fitImageToPDF(width, height, maxWidth, maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        return {
            width: width * ratio,
            height: height * ratio
        };
    }

    _formatFileSize(bytes) {
        if (!bytes) return 'N/A';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
    }
}

module.exports = new ExportService();
