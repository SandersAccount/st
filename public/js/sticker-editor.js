class StickerEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.textObjects = [];
        this.selectedText = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.scale = 1;
        this.baseImage = null;
        
        this.initializeEventListeners();
        this.setupImageUpload();
        
        // Check for image parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const imageUrl = urlParams.get('image');
        if (imageUrl) {
            this.loadImageFromUrl(imageUrl);
        }
    }

    initializeEventListeners() {
        // Text controls
        const addTextBtn = document.getElementById('addTextBtn');
        const textInput = document.getElementById('textInput');
        
        if (addTextBtn) {
            addTextBtn.addEventListener('click', () => this.addText());
        }
        
        if (textInput) {
            textInput.addEventListener('input', (e) => {
                if (this.selectedText) {
                    this.selectedText.text = e.target.value;
                    this.redraw();
                }
            });
        }

        // Warp control
        const warpSlider = document.getElementById('warpBendInput');
        const warpValue = warpSlider?.nextElementSibling;
        
        if (warpSlider && warpValue) {
            warpSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                warpValue.textContent = `${value}%`;
                
                if (this.selectedText) {
                    this.selectedText.warpBend = parseInt(value);
                    this.redraw();
                }
            });
        }

        // Letter spacing control
        const spacingSlider = document.getElementById('letterSpacingInput');
        const spacingValue = spacingSlider?.nextElementSibling;
        
        if (spacingSlider && spacingValue) {
            spacingSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                spacingValue.textContent = `${value}%`;
                
                if (this.selectedText) {
                    this.selectedText.letterSpacing = parseInt(value);
                    this.redraw();
                }
            });
        }

        // Font style controls
        const boldBtn = document.getElementById('boldBtn');
        const italicBtn = document.getElementById('italicBtn');
        const fontSelect = document.getElementById('fontSelect');
        const fontSizeInput = document.getElementById('fontSizeInput');
        
        if (boldBtn) {
            boldBtn.addEventListener('click', (e) => {
                if (this.selectedText) {
                    e.currentTarget.classList.toggle('active');
                    this.selectedText.isBold = e.currentTarget.classList.contains('active');
                    this.updateFontStyle();
                    this.redraw();
                }
            });
        }

        if (italicBtn) {
            italicBtn.addEventListener('click', (e) => {
                if (this.selectedText) {
                    e.currentTarget.classList.toggle('active');
                    this.selectedText.isItalic = e.currentTarget.classList.contains('active');
                    this.updateFontStyle();
                    this.redraw();
                }
            });
        }

        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => {
                if (this.selectedText) {
                    this.selectedText.font = e.target.value;
                    this.updateFontStyle();
                    this.redraw();
                }
            });
        }

        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (e) => {
                if (this.selectedText) {
                    this.selectedText.fontSize = parseInt(e.target.value);
                    this.updateFontStyle();
                    this.redraw();
                }
            });
        }

        // Stroke controls
        const strokeWidthInput = document.getElementById('strokeWidthInput');
        if (strokeWidthInput) {
            strokeWidthInput.addEventListener('input', (e) => {
                if (this.selectedText) {
                    this.selectedText.strokeWidth = parseInt(e.target.value);
                    this.redraw();
                }
            });
        }

        // Color pickers
        this.setupColorPicker('textColorPicker', (color) => {
            if (this.selectedText) {
                this.selectedText.color = color;
                this.redraw();
            }
        });

        this.setupColorPicker('strokeColorPicker', (color) => {
            if (this.selectedText) {
                this.selectedText.strokeColor = color;
                this.redraw();
            }
        });

        // Canvas interaction - single mousedown handler
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSticker());
        }

        // Delete button and keyboard shortcut
        const deleteTextBtn = document.getElementById('deleteTextBtn');
        if (deleteTextBtn) {
            deleteTextBtn.addEventListener('click', () => this.deleteSelectedText());
        }

        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedText) {
                this.deleteSelectedText();
            }
        });
    }

    setupColorPicker(pickerId, callback) {
        const colorOptions = document.querySelectorAll(`#${pickerId} .color-option`);
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                colorOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                callback(option.dataset.color);
            });
        });
    }

    updateFontStyle() {
        if (!this.selectedText) return;
        
        let fontStyle = '';
        if (this.selectedText.isItalic) fontStyle += 'italic ';
        if (this.selectedText.isBold) fontStyle += 'bold ';
        
        this.selectedText.fontStyle = fontStyle.trim();
    }

    addText() {
        const text = document.getElementById('textInput').value || 'New Text';
        const fontSize = parseInt(document.getElementById('fontSizeInput').value);
        const font = document.getElementById('fontSelect').value;
        const color = document.querySelector('#textColorPicker .color-option.active').dataset.color;
        const strokeColor = document.querySelector('#strokeColorPicker .color-option.active').dataset.color;
        const strokeWidth = parseInt(document.getElementById('strokeWidthInput').value);
        const warpBend = parseInt(document.getElementById('warpBendInput').value);
        const letterSpacing = parseInt(document.getElementById('letterSpacingInput').value);

        const textObj = {
            text,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            fontSize,
            font,
            color,
            strokeColor,
            strokeWidth,
            warpBend,
            letterSpacing,
            isBold: false,
            isItalic: false,
            fontStyle: ''
        };

        this.textObjects.push(textObj);
        this.selectedText = textObj;
        this.redraw();
    }

    drawWarpedText(text, x, y, bend) {
        // Draw straight text if no bend
        if (Math.abs(bend) < 0.1) {
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            if (this.ctx.lineWidth > 0) {
                this.ctx.strokeText(text, x, y);
            }
            this.ctx.fillText(text, x, y);
            return;
        }

        // Text settings
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Calculate basic parameters
        const textWidth = this.ctx.measureText(text).width;
        const letterSpacing = ((this.selectedText.letterSpacing || 10) / 100);
        
        // Calculate positions for each character
        const chars = text.split('');
        const charWidths = chars.map(char => this.ctx.measureText(char).width);
        const totalWidth = charWidths.reduce((sum, width) => sum + width, 0);
        
        // Add letter spacing to total width
        const spacedWidth = totalWidth * (1 + letterSpacing);
        
        // Calculate curve parameters
        const bendScale = bend / 100;
        const maxBendAngle = Math.PI / 3; // 60 degrees max
        const totalAngle = maxBendAngle * Math.abs(bendScale);
        
        // Calculate radius and center point
        const radius = spacedWidth / (2 * Math.sin(totalAngle/2));
        const centerY = bendScale > 0 ? 
            y + radius : 
            y - radius;
        
        // Calculate start angle based on direction
        const startAngle = bendScale > 0 ? 
            -Math.PI/2 - totalAngle/2 : 
            Math.PI/2 + totalAngle/2;
        
        // Draw each character
        let currentLength = 0;
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const charWidth = charWidths[i];
            
            // Calculate spacing for this character
            const charSpacing = charWidth * (1 + letterSpacing);
            currentLength += charSpacing / 2;
            
            // Calculate position on the curve
            const progress = currentLength / spacedWidth;
            const angle = startAngle + (bendScale > 0 ? totalAngle * progress : -totalAngle * progress);
            
            // Calculate character position relative to the center point
            const charX = x + radius * Math.cos(angle);
            const charY = centerY + radius * Math.sin(angle);
            
            // Save state
            this.ctx.save();
            
            // Move to position and rotate
            this.ctx.translate(charX, charY);
            
            // Rotate based on direction
            const rotationAngle = angle + (bendScale > 0 ? Math.PI/2 : -Math.PI/2);
            this.ctx.rotate(rotationAngle);
            
            // Draw character
            if (this.ctx.lineWidth > 0) {
                this.ctx.strokeText(char, 0, 0);
            }
            this.ctx.fillText(char, 0, 0);
            
            // Restore state
            this.ctx.restore();
            
            // Move to next character center
            currentLength += charSpacing / 2;
        }
    }

    redraw(forExport = false) {
        if (!this.ctx || !this.canvas) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw base image if exists
        if (this.baseImage && this.baseImage.image) {
            const { image, x, y, width, height } = this.baseImage;
            this.ctx.drawImage(image, x, y, width, height);
        }

        // Draw all text objects
        this.textObjects.forEach(textObj => {
            // Set font with style
            const fontString = `${textObj.fontStyle} ${textObj.fontSize}px ${textObj.font}`;
            this.ctx.font = fontString.trim();
            
            // Set up text styles
            if (textObj.strokeWidth > 0) {
                this.ctx.strokeStyle = textObj.strokeColor;
                this.ctx.lineWidth = textObj.strokeWidth;
            }
            this.ctx.fillStyle = textObj.color;

            // Draw the text (either warped or normal)
            if (textObj.warpBend && textObj.warpBend !== 0) {
                this.drawWarpedText(textObj.text, textObj.x, textObj.y, textObj.warpBend);
            } else {
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                if (textObj.strokeWidth > 0) {
                    this.ctx.strokeText(textObj.text, textObj.x, textObj.y);
                }
                this.ctx.fillText(textObj.text, textObj.x, textObj.y);
            }

            // Draw selection box if selected and not exporting
            if (textObj === this.selectedText && !forExport) {
                const metrics = this.ctx.measureText(textObj.text);
                const height = textObj.fontSize;
                const width = metrics.width;
                
                this.ctx.strokeStyle = '#0066ff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(
                    textObj.x - width/2 - 5,
                    textObj.y - height/2 - 5,
                    width + 10,
                    height + 10
                );

                // Update UI controls
                this.updateUIControls(textObj);
            }
        });
    }

    updateUIControls(textObj) {
        const elements = {
            textInput: document.getElementById('textInput'),
            fontSelect: document.getElementById('fontSelect'),
            fontSizeInput: document.getElementById('fontSizeInput'),
            strokeWidthInput: document.getElementById('strokeWidthInput'),
            warpBendInput: document.getElementById('warpBendInput'),
            letterSpacingInput: document.getElementById('letterSpacingInput'),
            boldBtn: document.getElementById('boldBtn'),
            italicBtn: document.getElementById('italicBtn')
        };

        if (elements.textInput) elements.textInput.value = textObj.text;
        if (elements.fontSelect) elements.fontSelect.value = textObj.font;
        if (elements.fontSizeInput) elements.fontSizeInput.value = textObj.fontSize;
        if (elements.strokeWidthInput) elements.strokeWidthInput.value = textObj.strokeWidth;
        
        if (elements.warpBendInput) {
            elements.warpBendInput.value = textObj.warpBend || 0;
            const warpValue = elements.warpBendInput.nextElementSibling;
            if (warpValue) {
                warpValue.textContent = `${textObj.warpBend || 0}%`;
            }
        }
        
        if (elements.letterSpacingInput) {
            elements.letterSpacingInput.value = textObj.letterSpacing || 10;
            const spacingValue = elements.letterSpacingInput.nextElementSibling;
            if (spacingValue) {
                spacingValue.textContent = `${textObj.letterSpacing || 10}%`;
            }
        }
        
        if (elements.boldBtn) elements.boldBtn.classList.toggle('active', textObj.isBold);
        if (elements.italicBtn) elements.italicBtn.classList.toggle('active', textObj.isItalic);
        
        // Update color pickers
        this.updateColorPicker('textColorPicker', textObj.color);
        this.updateColorPicker('strokeColorPicker', textObj.strokeColor);
    }

    updateColorPicker(pickerId, color) {
        const options = document.querySelectorAll(`#${pickerId} .color-option`);
        options.forEach(option => {
            option.classList.toggle('active', option.dataset.color === color);
        });
    }

    setupImageUpload() {
        const imageInput = document.getElementById('imageInput');
        const uploadArea = document.querySelector('.upload-area');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#0066ff';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#333';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#333';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadImage(file);
            }
        });
    }

    async loadImageFromUrl(url) {
        try {
            const response = await fetch(`/api/download?imageUrl=${encodeURIComponent(url)}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load image');
            }

            const blob = await response.blob();
            const file = new File([blob], 'image.png', { type: blob.type });
            await this.loadImage(file);
        } catch (error) {
            console.error('Error loading image from URL:', error);
        }
    }

    getScaledMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleMouseDown(e) {
        const { x, y } = this.getScaledMousePosition(e);

        // Check if clicked on any text object
        this.textObjects.forEach(textObj => {
            this.ctx.font = `${textObj.fontStyle} ${textObj.fontSize}px ${textObj.font}`;
            const metrics = this.ctx.measureText(textObj.text);
            const height = textObj.fontSize;
            const width = metrics.width;

            if (x >= textObj.x - width/2 && x <= textObj.x + width/2 &&
                y >= textObj.y - height/2 && y <= textObj.y + height/2) {
                this.selectedText = textObj;
                this.isDragging = true;
                this.dragStartX = x - textObj.x;
                this.dragStartY = y - textObj.y;
                this.redraw();
            }
        });
    }

    handleMouseMove(e) {
        if (this.isDragging && this.selectedText) {
            const { x, y } = this.getScaledMousePosition(e);

            this.selectedText.x = x - this.dragStartX;
            this.selectedText.y = y - this.dragStartY;
            this.redraw();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Set canvas size to match image dimensions
                this.canvas.width = img.width;
                this.canvas.height = img.height;

                // Draw image at full size
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0, img.width, img.height);
                this.baseImage = {
                    image: img,
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height
                };

                // Make canvas responsive while maintaining aspect ratio
                const container = document.querySelector('.canvas-container');
                const containerStyle = window.getComputedStyle(container);
                const maxWidth = parseInt(containerStyle.width) - 40; // 40px for padding
                const scale = Math.min(1, maxWidth / img.width);
                
                this.canvas.style.width = `${img.width * scale}px`;
                this.canvas.style.height = `${img.height * scale}px`;
                this.scale = scale;
                
                this.redraw();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    exportSticker() {
        // Draw without selection box
        this.redraw(true);
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.download = 'sticker.png';
        link.href = this.canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Redraw with selection box
        this.redraw();
    }

    deleteSelectedText() {
        if (this.selectedText) {
            const index = this.textObjects.indexOf(this.selectedText);
            if (index > -1) {
                this.textObjects.splice(index, 1);
                this.selectedText = null;
                this.redraw();
            }
        }
    }
}

// Initialize the editor when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new StickerEditor();
});
