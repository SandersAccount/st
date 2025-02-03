const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const Color = require('color');

class ImageProcessor {
    constructor() {
        this.filters = {
            vintage: this._vintageFilter.bind(this),
            noir: this._noirFilter.bind(this),
            comic: this._comicFilter.bind(this),
            pixelate: this._pixelateFilter.bind(this),
            duotone: this._duotoneFilter.bind(this),
            glitch: this._glitchFilter.bind(this)
        };
    }

    async applyFilter(buffer, filterName, options = {}) {
        if (!this.filters[filterName]) {
            throw new Error(`Filter '${filterName}' not found`);
        }

        return await this.filters[filterName](buffer, options);
    }

    async _vintageFilter(buffer) {
        return sharp(buffer)
            .modulate({
                brightness: 1.1,
                saturation: 0.8,
                hue: 15
            })
            .tint({ r: 240, g: 220, b: 190 })
            .gamma(1.2)
            .toBuffer();
    }

    async _noirFilter(buffer) {
        return sharp(buffer)
            .grayscale()
            .modulate({
                brightness: 1.1,
                contrast: 1.3
            })
            .gamma(1.3)
            .toBuffer();
    }

    async _comicFilter(buffer, { threshold = 128 } = {}) {
        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(image, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply comic effect
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const color = brightness > threshold ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = color;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toBuffer();
    }

    async _pixelateFilter(buffer, { pixelSize = 10 } = {}) {
        const metadata = await sharp(buffer).metadata();
        const width = Math.ceil(metadata.width / pixelSize) * pixelSize;
        const height = Math.ceil(metadata.height / pixelSize) * pixelSize;

        return sharp(buffer)
            .resize(width / pixelSize, height / pixelSize, { fit: 'fill' })
            .resize(width, height, { kernel: 'nearest' })
            .toBuffer();
    }

    async _duotoneFilter(buffer, { 
        highlight = '#ffffff',
        shadow = '#000000'
    } = {}) {
        const highlightColor = Color(highlight);
        const shadowColor = Color(shadow);

        return sharp(buffer)
            .grayscale()
            .modulate({ brightness: 1.2 })
            .tint({
                r: shadowColor.red(),
                g: shadowColor.green(),
                b: shadowColor.blue()
            })
            .gamma(1.2)
            .toBuffer();
    }

    async _glitchFilter(buffer, {
        amount = 10,
        seed = Math.random()
    } = {}) {
        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(image, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply glitch effect
        for (let i = 0; i < amount; i++) {
            const x = Math.floor(seed * canvas.width);
            const y = Math.floor(Math.random() * canvas.height);
            const length = Math.floor(Math.random() * 30) + 10;

            for (let j = 0; j < length; j++) {
                const offset = ((y + j) * canvas.width + x) * 4;
                const shift = Math.floor(Math.random() * 20) - 10;

                for (let k = 0; k < canvas.width - Math.abs(shift); k++) {
                    const sourceOffset = offset + k * 4;
                    const targetOffset = offset + (k + shift) * 4;

                    if (targetOffset >= 0 && targetOffset < data.length - 3) {
                        data[targetOffset] = data[sourceOffset];
                        data[targetOffset + 1] = data[sourceOffset + 1];
                        data[targetOffset + 2] = data[sourceOffset + 2];
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toBuffer();
    }

    // Advanced image processing methods
    async addWatermark(buffer, watermarkText, options = {}) {
        const {
            fontSize = 48,
            opacity = 0.5,
            rotation = -45,
            color = '#ffffff'
        } = options;

        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(image, 0, 0);

        // Configure watermark
        ctx.globalAlpha = opacity;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = color;

        // Rotate and position watermark
        ctx.translate(image.width / 2, image.height / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.fillText(watermarkText, -ctx.measureText(watermarkText).width / 2, 0);

        return canvas.toBuffer();
    }

    async createCollage(buffers, options = {}) {
        const {
            columns = 2,
            spacing = 10,
            backgroundColor = '#ffffff'
        } = options;

        const images = await Promise.all(buffers.map(loadImage));
        const maxWidth = Math.max(...images.map(img => img.width));
        const maxHeight = Math.max(...images.map(img => img.height));

        const rows = Math.ceil(images.length / columns);
        const canvas = createCanvas(
            columns * (maxWidth + spacing) - spacing,
            rows * (maxHeight + spacing) - spacing
        );
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw images
        images.forEach((img, i) => {
            const row = Math.floor(i / columns);
            const col = i % columns;
            const x = col * (maxWidth + spacing);
            const y = row * (maxHeight + spacing);

            ctx.drawImage(img, x, y);
        });

        return canvas.toBuffer();
    }

    async addFrame(buffer, options = {}) {
        const {
            width = 20,
            color = '#ffffff',
            style = 'solid'
        } = options;

        const image = await loadImage(buffer);
        const canvas = createCanvas(
            image.width + width * 2,
            image.height + width * 2
        );
        const ctx = canvas.getContext('2d');

        // Draw frame
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (style === 'gradient') {
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, Color(color).lighten(0.3).hex());
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw image
        ctx.drawImage(image, width, width);

        return canvas.toBuffer();
    }
}

module.exports = new ImageProcessor();
