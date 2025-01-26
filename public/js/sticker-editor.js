class StickerEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.textObjects = [];
        this.selectedText = null;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.scale = 1;
        this.baseImage = null;
        this.loadedFonts = new Set();
        this.showSelectionOutline = true;  // New flag to control outline visibility
        
        // Font filename mapping
        this.fontFiles = {
            
          "Angeline Regular": "angeline.ttf",
          "Hartone Regular": "Hartone Softed.ttf",
          "Airstrike": "airstrike.ttf",
          "Lemon Milk": "lemonmilk.ttf",
          "Super Bubble": "Super Bubble.ttf",
          "Grobold": "GROBOLD.ttf",
          "Godzilla": "Godzilla.ttf",
          "Insaniburger": "Insanibc.ttf",
          "Forky": "1. Forky.ttf",
          "Commando": "commando.ttf",
          "Borgsquad": "borgsquad.ttf",
          "Snickers": "SNICN___.TTF",
          "Roboto Black": "Roboto-Black.ttf",
          "Super Cartoon": "Super Cartoon.ttf",
          "Heavitas": "Heavitas.ttf",
          "Starborn": "Starborn.ttf"

        };
        
        // Get available fonts from CSS
        const fontList = getComputedStyle(document.documentElement)
            .getPropertyValue('--available-fonts')
            .split(',')
            .map(font => font.trim().replace(/['"]/g, ''));
        
        this.defaultFont = fontList[0]; // Use first font as default
        this.availableFonts = fontList;
        
        // Initialize canvas size
        this.resizeCanvas();
        
        // Initialize UI
        this.initializeEventListeners();
        this.setupImageUpload();
        this.setupSliders();
        this.setupColorPickers();
        this.setupFontMenuEvents();
        this.setupCanvasMenu();
        this.generateFontMenu(); // Generate font menu after setting up events
        
        // Try to load fonts in the background
        this.loadFonts().then(() => {
            // Add default text with specific properties after fonts are loaded
            const defaultText = {
                text: 'Amazing!',
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                font: 'Heavitas',
                fontSize: 200,
                color: '#000000',
                strokeWidth: 30,
                strokeColor: '#ffffff',
                warpBend: 60,
                letterSpacing: 2,
                isBold: false,
                isItalic: false,
                fontStyle: ''
            };

            this.textObjects.push(defaultText);
            this.selectedText = defaultText;
            
            // Update UI with default text
            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.value = defaultText.text;
            }
            
            this.updateUIControls(defaultText);
            this.redraw();
        });

        // Check for image URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const imageUrl = urlParams.get('image');
        if (imageUrl) {
            this.loadImageFromUrl(imageUrl);
        }
    }

    async loadImageFromUrl(imageUrl) {
        try {
            // First fetch the image through the download endpoint with credentials
            const response = await fetch(`/api/download?imageUrl=${encodeURIComponent(imageUrl)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load image');
            }

            // Get the blob from response
            const blob = await response.blob();
            
            // Create object URL from blob
            const objectUrl = URL.createObjectURL(blob);
            
            // Load the image
            const img = new Image();
            img.onload = () => {
                // Store original dimensions
                img.originalWidth = img.width;
                img.originalHeight = img.height;
                
                this.baseImage = img;
                this.resizeCanvas(); // This will now use the original dimensions
                this.redraw();
                URL.revokeObjectURL(objectUrl);
            };
            img.onerror = () => {
                console.error('Failed to load image');
                URL.revokeObjectURL(objectUrl);
            };
            img.src = objectUrl;
        } catch (error) {
            console.error('Error loading image:', error);
        }
    }

    setupSliders() {
        // Font size input
        const fontSizeInput = document.getElementById('fontSizeInput');
        const fontSizeValue = fontSizeInput?.nextElementSibling;
        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.selectedText) {
                    this.selectedText.fontSize = parseInt(value);
                    if (fontSizeValue) {
                        fontSizeValue.textContent = value;
                    }
                    this.redraw();
                }
            });
        }

        // Stroke width input
        const strokeWidthInput = document.getElementById('strokeWidthInput');
        const strokeWidthValue = strokeWidthInput?.nextElementSibling;
        if (strokeWidthInput) {
            strokeWidthInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.selectedText) {
                    this.selectedText.strokeWidth = parseInt(value);
                    if (strokeWidthValue) {
                        strokeWidthValue.textContent = value;
                    }
                    this.redraw();
                }
            });
        }

        // Warp bend input
        const warpBendInput = document.getElementById('warpBendInput');
        const warpBendValue = warpBendInput?.nextElementSibling;
        if (warpBendInput) {
            warpBendInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.selectedText) {
                    this.selectedText.warpBend = parseInt(value);
                    if (warpBendValue) {
                        warpBendValue.textContent = value + '%';
                    }
                    this.redraw();
                }
            });
        }

        // Letter spacing input
        const letterSpacingInput = document.getElementById('letterSpacingInput');
        const letterSpacingValue = letterSpacingInput?.nextElementSibling;
        if (letterSpacingInput) {
            letterSpacingInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.selectedText) {
                    this.selectedText.letterSpacing = parseInt(value);
                    if (letterSpacingValue) {
                        letterSpacingValue.textContent = value + '%';
                    }
                    this.redraw();
                }
            });
        }
    }

    setupColorPickers() {
        // Text color picker
        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) {
            textColorPicker.addEventListener('click', (e) => {
                const colorOption = e.target.closest('.color-option');
                if (!colorOption) return;

                // Update active state
                textColorPicker.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                colorOption.classList.add('active');

                // Update selected text color
                if (this.selectedText) {
                    this.selectedText.color = colorOption.dataset.color;
                    this.redraw();
                }
            });
        }

        // Stroke color picker
        const strokeColorPicker = document.getElementById('strokeColorPicker');
        if (strokeColorPicker) {
            strokeColorPicker.addEventListener('click', (e) => {
                const colorOption = e.target.closest('.color-option');
                if (!colorOption) return;

                // Update active state
                strokeColorPicker.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                colorOption.classList.add('active');

                // Update selected text stroke color
                if (this.selectedText) {
                    this.selectedText.strokeColor = colorOption.dataset.color;
                    this.redraw();
                }
            });
        }
    }

    setupFontMenuEvents() {
        const fontMenu = document.getElementById('fontMenu');
        const fontMenuHeader = document.getElementById('fontMenuHeader');

        if (fontMenuHeader) {
            fontMenuHeader.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent document click from immediately closing
                fontMenu.classList.toggle('show');
            });
        }

        if (fontMenu) {
            fontMenu.addEventListener('click', (e) => {
                const option = e.target.closest('.font-option');
                if (option) {
                    const fontName = option.getAttribute('data-font');
                    if (this.selectedText) {
                        this.selectedText.font = fontName;
                        this.redraw();
                    }
                    this.updateSelectedFont(fontName);
                    fontMenu.classList.remove('show');
                }
            });
        }

        // Close font menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.font-menu-wrapper')) {
                fontMenu.classList.remove('show');
            }
        });
    }

    setupCanvasMenu() {
        // Get menu buttons
        const upscaleBtn = document.getElementById('upscaleBtn');
        const addToCollectionBtn = document.getElementById('addToCollectionBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const bgRemoveBtn = document.getElementById('bgRemoveBtn');
        const deleteBtn = document.getElementById('deleteBtn');

        // Upscale functionality
        upscaleBtn?.addEventListener('click', async () => {
            try {
                upscaleBtn.disabled = true;
                const loadingHtml = `
                    <img src="/images/ph--arrow-square-up-right-light.svg" alt="Upscale" />
                    Upscaling...
                `;
                upscaleBtn.innerHTML = loadingHtml;

                // Convert canvas to data URL without selection outline
                const imageData = await this.captureCanvas();
                
                // Upload the image first
                const formData = new FormData();
                formData.append('image', await (await fetch(imageData)).blob());
                
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }
                
                const { imageUrl } = await uploadResponse.json();

                // Now upscale the uploaded image
                const response = await fetch('/api/images/upscale', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ imageUrl })
                });

                if (!response.ok) {
                    throw new Error('Failed to upscale image');
                }

                const data = await response.json();
                
                // Load the upscaled image back to canvas
                await this.loadImageFromUrl(data.imageUrl);
                
                // Reset button
                upscaleBtn.disabled = false;
                upscaleBtn.innerHTML = `
                    <img src="/images/ph--arrow-square-up-right-light.svg" alt="Upscale" />
                    Upscale Image
                `;
            } catch (error) {
                console.error('Error upscaling image:', error);
                showToast(error.message, 'error');
                upscaleBtn.disabled = false;
                upscaleBtn.innerHTML = `
                    <img src="/images/ph--arrow-square-up-right-light.svg" alt="Upscale" />
                    Upscale Image
                `;
            }
        });

        // Add to collection functionality
        addToCollectionBtn?.addEventListener('click', async () => {
            try {
                // Convert canvas to data URL without selection outline
                const imageData = await this.captureCanvas();
                
                // Upload the image first
                const formData = new FormData();
                formData.append('image', await (await fetch(imageData)).blob());
                
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }
                
                const { imageUrl } = await uploadResponse.json();

                // Show collection modal
                const collectionModal = document.querySelector('collection-modal');
                if (collectionModal) {
                    collectionModal.setImageData(imageUrl);
                    collectionModal.show();
                } else {
                    throw new Error('Collection modal not found');
                }
            } catch (error) {
                console.error('Error adding to collection:', error);
                showToast(error.message, 'error');
            }
        });

        // Download functionality
        downloadBtn?.addEventListener('click', async () => {
            try {
                const link = document.createElement('a');
                link.download = `sticker-${Date.now()}.png`;
                // Get canvas data URL without selection outline
                link.href = await this.captureCanvas();
                link.click();
            } catch (error) {
                console.error('Error downloading image:', error);
                showToast(error.message, 'error');
            }
        });

        // Background removal functionality
        bgRemoveBtn?.addEventListener('click', async () => {
            try {
                bgRemoveBtn.disabled = true;
                const loadingHtml = `
                    <img src="/images/ph--images-square-light.svg" alt="BG Remove" />
                    Removing BG...
                `;
                bgRemoveBtn.innerHTML = loadingHtml;

                // Convert canvas to data URL without selection outline
                const imageData = await this.captureCanvas();
                
                // Upload the image first
                const formData = new FormData();
                formData.append('image', await (await fetch(imageData)).blob());
                
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }
                
                const { imageUrl } = await uploadResponse.json();

                // Now remove background
                const response = await fetch('/api/images/bgremove', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ imageUrl })
                });

                if (!response.ok) {
                    throw new Error('Failed to remove background');
                }

                const data = await response.json();
                
                // Load the processed image back to canvas
                await this.loadImageFromUrl(data.imageUrl);
                
                // Reset button
                bgRemoveBtn.disabled = false;
                bgRemoveBtn.innerHTML = `
                    <img src="/images/ph--images-square-light.svg" alt="BG Remove" />
                    BG Remove
                `;
            } catch (error) {
                console.error('Error removing background:', error);
                showToast(error.message, 'error');
                bgRemoveBtn.disabled = false;
                bgRemoveBtn.innerHTML = `
                    <img src="/images/ph--images-square-light.svg" alt="BG Remove" />
                    BG Remove
                `;
            }
        });

        // Delete functionality
        deleteBtn?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the canvas?')) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.baseImage = null;
                this.textObjects = [];
                this.selectedText = null;
                this.render();
            }
        });
    }

    updateSelectedFont(fontName) {
        const fontMenuHeader = document.getElementById('fontMenuHeader');
        if (fontMenuHeader) {
            fontMenuHeader.setAttribute('data-selected-font', fontName);
            const selectedFontSpan = fontMenuHeader.querySelector('.selected-font');
            if (selectedFontSpan) {
                selectedFontSpan.textContent = fontName;
                selectedFontSpan.style.fontFamily = `'${fontName}', var(--fallback-display)`;
            }
        }
    }

    generateFontMenu() {
        const fontMenu = document.getElementById('fontMenu');
        const fontMenuHeader = document.getElementById('fontMenuHeader');
        
        if (!fontMenu || !fontMenuHeader) return;
        
        // Clear existing content
        fontMenu.innerHTML = '';
        
        // Set default font in header
        this.updateSelectedFont(this.defaultFont);
        
        // Generate font options
        this.availableFonts.forEach(fontName => {
            const option = document.createElement('div');
            option.className = 'font-option';
            option.setAttribute('data-font', fontName);
            
            // Create preview text element
            const preview = document.createElement('span');
            preview.className = 'preview-text';
            preview.textContent = 'Sample Text';
            preview.style.fontFamily = `'${fontName}', var(--fallback-display)`;
            
            // Create font name element
            const name = document.createElement('span');
            name.className = 'font-name';
            name.textContent = fontName;
            
            option.appendChild(preview);
            option.appendChild(name);
            fontMenu.appendChild(option);
        });
    }

    async loadFonts() {
        try {
            // Load all available fonts
            const fontPromises = this.availableFonts.map(async fontName => {
                try {
                    const filename = this.fontFiles[fontName];
                    if (!filename) {
                        console.warn(`No filename mapping for font: ${fontName}`);
                        return;
                    }
                    
                    // Create and load the font
                    const font = new FontFace(fontName, `url('/fonts/${filename}')`);
                    await font.load();
                    document.fonts.add(font);
                    this.loadedFonts.add(fontName);
                    console.log(`Loaded font: ${fontName}`);
                    
                    // Update the font menu after each font is loaded
                    if (document.getElementById('fontMenu')) {
                        this.generateFontMenu();
                    }
                } catch (fontError) {
                    console.warn(`Failed to load font ${fontName}:`, fontError);
                }
            });

            // Wait for all fonts to load
            await Promise.all(fontPromises);
            
            // Additional check specifically for Heavitas
            if (!document.fonts.check('12px Heavitas')) {
                console.warn('Heavitas font not loaded, retrying...');
                const heavitasFont = new FontFace('Heavitas', `url('/fonts/Heavitas.ttf')`);
                await heavitasFont.load();
                document.fonts.add(heavitasFont);
            }
        } catch (error) {
            console.error('Error in loadFonts:', error);
        }
    }

    initializeEventListeners() {
        // Add text button
        const addTextBtn = document.getElementById('addTextBtn');
        if (addTextBtn) {
            addTextBtn.addEventListener('click', () => this.addText());
        }

        // Text input change listener
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('input', () => {
                if (this.selectedText) {
                    this.selectedText.text = textInput.value;
                    this.redraw();
                }
            });
        }

        // Delete text button
        const deleteTextBtn = document.getElementById('deleteTextBtn');
        if (deleteTextBtn) {
            deleteTextBtn.addEventListener('click', () => {
                if (this.selectedText) {
                    const index = this.textObjects.indexOf(this.selectedText);
                    if (index > -1) {
                        this.textObjects.splice(index, 1);
                        this.selectedText = null;
                        this.redraw();
                    }
                }
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    // Draw without selection box
                    this.redraw(true);
                    
                    // Get the canvas data URL
                    const dataUrl = this.canvas.toDataURL('image/png');
                    
                    // Create download link
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `sticker-${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } catch (error) {
                    console.error('Error exporting image:', error);
                    alert('Failed to export image. Please try again.');
                } finally {
                    // Redraw with selection box if needed
                    this.redraw();
                }
            });
        }

        // Canvas event listeners
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    setupImageUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        this.baseImage = img;
                        this.resizeCanvas();
                        this.redraw();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        const dropZone = document.getElementById('editor-canvas');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            this.baseImage = img;
                            this.resizeCanvas();
                            this.redraw();
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;

        if (this.baseImage) {
            // Use the base image dimensions
            this.canvas.width = this.baseImage.originalWidth;
            this.canvas.height = this.baseImage.originalHeight;
        } else {
            // If no image, use container dimensions
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
        
        this.redraw();
    }

    addText() {
        const text = document.getElementById('textInput').value || 'Sample Text';
        const textObj = {
            text: text,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            font: this.defaultFont,
            fontSize: 48,
            color: '#ffffff',
            strokeWidth: 0,
            strokeColor: '#000000',
            warpBend: 0,
            letterSpacing: 10,
            isBold: false,
            isItalic: false,
            fontStyle: ''
        };

        this.textObjects.push(textObj);
        this.selectedText = textObj;
        this.updateUIControls();
        this.redraw();
    }

    updateUIControls() {
        if (!this.selectedText) return;

        // Update text input
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.value = this.selectedText.text;
        }

        // Update font size slider and value
        const fontSizeInput = document.getElementById('fontSizeInput');
        const fontSizeValue = fontSizeInput?.nextElementSibling;
        if (fontSizeInput) {
            fontSizeInput.value = this.selectedText.fontSize;
            if (fontSizeValue) {
                fontSizeValue.textContent = this.selectedText.fontSize;
            }
        }

        // Update stroke width slider and value
        const strokeWidthInput = document.getElementById('strokeWidthInput');
        const strokeWidthValue = strokeWidthInput?.nextElementSibling;
        if (strokeWidthInput) {
            strokeWidthInput.value = this.selectedText.strokeWidth;
            if (strokeWidthValue) {
                strokeWidthValue.textContent = this.selectedText.strokeWidth;
            }
        }

        // Update warp slider and value
        const warpBendInput = document.getElementById('warpBendInput');
        const warpBendValue = warpBendInput?.nextElementSibling;
        if (warpBendInput) {
            warpBendInput.value = this.selectedText.warpBend || 0;
            if (warpBendValue) {
                warpBendValue.textContent = (this.selectedText.warpBend || 0) + '%';
            }
        }

        // Update letter spacing slider and value
        const letterSpacingInput = document.getElementById('letterSpacingInput');
        const letterSpacingValue = letterSpacingInput?.nextElementSibling;
        if (letterSpacingInput) {
            letterSpacingInput.value = this.selectedText.letterSpacing || 10;
            if (letterSpacingValue) {
                letterSpacingValue.textContent = (this.selectedText.letterSpacing || 10) + '%';
            }
        }

        // Update color pickers
        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) {
            textColorPicker.value = this.selectedText.color;
        }

        const strokeColorPicker = document.getElementById('strokeColorPicker');
        if (strokeColorPicker) {
            strokeColorPicker.value = this.selectedText.strokeColor;
        }

        // Update selected font
        this.updateSelectedFont(this.selectedText.font);
    }

    handleMouseDown(e) {
        const { x, y } = this.getMousePosition(e);
        
        // Deselect previous selection
        this.selectedText = null;
        
        // Check if clicked on any text object
        for (const textObj of this.textObjects) {
            // Set up text context for accurate measurements
            this.ctx.font = `${textObj.fontSize}px "${textObj.font}"`;
            const metrics = this.ctx.measureText(textObj.text);
            const height = textObj.fontSize;
            const width = metrics.width;
            
            // Add some padding to make it easier to click
            const padding = 20;
            
            // Check if click is within text bounds
            if (x >= textObj.x - width/2 - padding && 
                x <= textObj.x + width/2 + padding &&
                y >= textObj.y - height/2 - padding && 
                y <= textObj.y + height/2 + padding) {
                
                this.selectedText = textObj;
                this.isDragging = true;
                this.lastX = x - textObj.x;
                this.lastY = y - textObj.y;
                this.updateUIControls(textObj);
                break;
            }
        }
        
        this.redraw();
    }

    handleMouseMove(e) {
        if (this.isDragging && this.selectedText) {
            const { x, y } = this.getMousePosition(e);
            
            // Ensure text stays within canvas bounds
            const metrics = this.ctx.measureText(this.selectedText.text);
            const width = metrics.width;
            const height = this.selectedText.fontSize;
            const padding = 20;
            
            // Calculate bounds
            const minX = width/2 + padding;
            const maxX = this.canvas.width - width/2 - padding;
            const minY = height/2 + padding;
            const maxY = this.canvas.height - height/2 - padding;
            
            // Update position with bounds checking
            this.selectedText.x = Math.min(Math.max(x - this.lastX, minX), maxX);
            this.selectedText.y = Math.min(Math.max(y - this.lastY, minY), maxY);
            
            this.redraw();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    async captureCanvas() {
        // Hide selection outline
        const previousState = this.showSelectionOutline;
        this.showSelectionOutline = false;
        this.redraw();

        // Capture canvas state
        const imageData = this.canvas.toDataURL('image/png');

        // Restore selection outline
        this.showSelectionOutline = previousState;
        this.redraw();

        return imageData;
    }

    redraw(forExport = false) {
        if (!this.ctx || !this.canvas) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw base image if exists
        if (this.baseImage) {
            // Define margin (percentage of canvas size)
            const marginPercent = 0.1; // 10% margin
            const availableWidth = this.canvas.width * (1 - 2 * marginPercent);
            const availableHeight = this.canvas.height * (1 - 2 * marginPercent);
            
            // Calculate scale to fit image within available space
            const scaleWidth = availableWidth / this.baseImage.width;
            const scaleHeight = availableHeight / this.baseImage.height;
            const scale = Math.min(scaleWidth, scaleHeight, 1); // Don't scale up, only down if needed
            
            // Calculate new dimensions
            const newWidth = this.baseImage.width * scale;
            const newHeight = this.baseImage.height * scale;
            
            // Calculate position to center the image
            const x = (this.canvas.width - newWidth) / 2;
            const y = (this.canvas.height - newHeight) / 2;
            
            // Draw the image scaled and centered
            this.ctx.drawImage(this.baseImage, x, y, newWidth, newHeight);
        }

        // Draw all text objects
        this.textObjects.forEach(textObj => {
            // Set font
            this.ctx.font = `${textObj.fontSize}px "${textObj.font}"`;
            
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
            if (textObj === this.selectedText && this.showSelectionOutline && !forExport) {
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
        
        // Get letter spacing from the text object or use default
        const letterSpacing = (this.textObjects.find(t => t.text === text)?.letterSpacing || 2) / 100;
        
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
            
            // Calculate rotation angle for the character
            const rotationAngle = angle + (bendScale > 0 ? Math.PI/2 : -Math.PI/2);
            
            // Save context state
            this.ctx.save();
            
            // Move to character position and rotate
            this.ctx.translate(charX, charY);
            this.ctx.rotate(rotationAngle);
            
            // Draw the character
            if (this.ctx.lineWidth > 0) {
                this.ctx.strokeText(char, 0, 0);
            }
            this.ctx.fillText(char, 0, 0);
            
            // Restore context state
            this.ctx.restore();
            
            // Move to next character position
            currentLength += charSpacing / 2;
        }
    }

    drawSelectionBox(textObj) {
        const metrics = this.ctx.measureText(textObj.text);
        const height = textObj.fontSize;
        const width = metrics.width;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            textObj.x - width/2 - 10,
            textObj.y - height/2 - 10,
            width + 20,
            height + 20
        );
        this.ctx.restore();
    }

    getFontStyle(textObj) {
        let style = '';
        if (textObj.isBold) style += 'bold ';
        if (textObj.isItalic) style += 'italic ';
        return style.trim();
    }
}

// Initialize the editor when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('editor-canvas');
    if (canvas) {
        new StickerEditor(canvas);
    }
});
