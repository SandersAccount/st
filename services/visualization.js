const sharp = require('sharp');
const Collection = require('../models/Collection');
const Image = require('../models/Image');
const Tag = require('../models/Tag');

class VisualizationService {
    async createUsageHeatmap(userId, options = {}) {
        const {
            days = 365,
            width = 800,
            height = 200,
            colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
        } = options;

        // Get activity data
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const activities = await Promise.all([
            Collection.find({
                owner: userId,
                createdAt: { $gte: startDate }
            }).select('createdAt'),
            Image.find({
                createdBy: userId,
                createdAt: { $gte: startDate }
            }).select('createdAt'),
            Tag.find({
                createdBy: userId,
                createdAt: { $gte: startDate }
            }).select('createdAt')
        ]);

        // Count activities per day
        const dailyCounts = new Map();
        activities.flat().forEach(item => {
            const date = item.createdAt.toISOString().split('T')[0];
            dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        });

        // Create SVG heatmap
        const cols = Math.ceil(days / 7);
        const cellSize = Math.floor(width / cols);
        const rowHeight = Math.floor(height / 7);

        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Draw cells
        let currentDate = new Date(startDate);
        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < 7; row++) {
                const date = currentDate.toISOString().split('T')[0];
                const count = dailyCounts.get(date) || 0;
                const colorIndex = Math.min(
                    Math.floor(count / 2),
                    colors.length - 1
                );

                svgContent += `
                    <rect 
                        x="${col * cellSize}" 
                        y="${row * rowHeight}"
                        width="${cellSize - 1}"
                        height="${rowHeight - 1}"
                        fill="${colors[colorIndex]}"
                    />`;

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        svgContent += '</svg>';

        // Convert SVG to PNG using Sharp
        const buffer = await sharp(Buffer.from(svgContent))
            .png()
            .toBuffer();

        return buffer;
    }

    async createTagCloud(collectionId, options = {}) {
        const {
            width = 800,
            height = 400,
            maxFontSize = 48,
            minFontSize = 12
        } = options;

        const collection = await Collection.findById(collectionId)
            .populate('images');

        if (!collection) {
            throw new Error('Collection not found');
        }

        // Count tag occurrences
        const tagCounts = new Map();
        collection.images.forEach(image => {
            image.tags.forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });

        // Sort tags by count
        const sortedTags = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1]);

        const maxCount = sortedTags[0]?.[1] || 1;

        // Create SVG tag cloud
        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        
        let currentX = width / 4;
        let currentY = height / 4;
        let row = 0;

        sortedTags.forEach(([tag, count], index) => {
            const fontSize = this._scaleFontSize(
                count,
                maxCount,
                minFontSize,
                maxFontSize
            );

            const color = this._getRandomColor();
            
            // Simple layout: arrange in rows
            if (currentX + fontSize * tag.name.length > width - 20) {
                currentX = width / 4;
                currentY += fontSize * 1.5;
                row++;
            }

            if (currentY < height - 20) {
                svgContent += `
                    <text 
                        x="${currentX}" 
                        y="${currentY}"
                        font-family="Arial"
                        font-size="${fontSize}"
                        fill="${color}"
                    >${tag.name}</text>`;

                currentX += fontSize * tag.name.length + 10;
            }
        });

        svgContent += '</svg>';

        // Convert SVG to PNG using Sharp
        const buffer = await sharp(Buffer.from(svgContent))
            .png()
            .toBuffer();

        return buffer;
    }

    async createTimelineChart(collectionId, options = {}) {
        const {
            width = 800,
            height = 400,
            padding = 40
        } = options;

        const collection = await Collection.findById(collectionId)
            .populate('images');

        if (!collection) {
            throw new Error('Collection not found');
        }

        // Group images by date
        const timelineData = new Map();
        collection.images.forEach(image => {
            const date = image.createdAt.toISOString().split('T')[0];
            timelineData.set(date, (timelineData.get(date) || 0) + 1);
        });

        // Sort dates
        const sortedDates = Array.from(timelineData.keys()).sort();
        const maxCount = Math.max(...timelineData.values());

        // Create SVG timeline
        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Draw axes
        svgContent += `
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="black" />
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="black" />
        `;

        // Draw data points
        const xStep = (width - 2 * padding) / (sortedDates.length - 1);
        const yScale = (height - 2 * padding) / maxCount;

        let pathData = '';
        sortedDates.forEach((date, i) => {
            const x = padding + i * xStep;
            const y = height - padding - timelineData.get(date) * yScale;

            if (i === 0) {
                pathData = `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        });

        svgContent += `<path d="${pathData}" stroke="#2196F3" fill="none" stroke-width="2" />`;
        svgContent += '</svg>';

        // Convert SVG to PNG using Sharp
        const buffer = await sharp(Buffer.from(svgContent))
            .png()
            .toBuffer();

        return buffer;
    }

    _scaleFontSize(count, maxCount, min, max) {
        return min + (max - min) * (count / maxCount);
    }

    _getRandomColor() {
        const colors = [
            '#2196F3', '#4CAF50', '#F44336', '#FFC107',
            '#9C27B0', '#00BCD4', '#FF5722', '#795548'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

module.exports = new VisualizationService();
