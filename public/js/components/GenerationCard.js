import { CollectionSelector } from './CollectionSelector.js';

export class GenerationCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageUrl = '';
        this._prompt = '';
        this._isUpscaled = false;
        this._id = '';
        this.connectedCallback();
    }

    static get observedAttributes() {
        return ['image-url', 'prompt', 'is-upscaled', 'generation-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'image-url':
                this._imageUrl = newValue;
                break;
            case 'prompt':
                this._prompt = newValue;
                break;
            case 'is-upscaled':
                this._isUpscaled = newValue === 'true';
                break;
            case 'generation-id':
                this._id = newValue;
                break;
        }
        
        this.render();
    }

    get imageUrl() {
        return this._imageUrl;
    }

    set imageUrl(value) {
        if (value !== this._imageUrl) {
            this._imageUrl = value;
            this.setAttribute('image-url', value);
        }
    }

    get prompt() {
        return this._prompt;
    }

    set prompt(value) {
        this._prompt = value;
        this.setAttribute('prompt', value);
    }

    get isUpscaled() {
        return this._isUpscaled;
    }

    set isUpscaled(value) {
        this._isUpscaled = value;
        this.setAttribute('is-upscaled', value);
    }

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
        this.setAttribute('generation-id', value);
    }

    checkAndRemoveDuplicate() {
        if (!this._imageUrl) return;
        
        // Get all generation cards
        const allCards = document.querySelectorAll('generation-card');
        const currentIndex = Array.from(allCards).indexOf(this);
        
        // Check for duplicates before this card
        allCards.forEach((card, index) => {
            if (index !== currentIndex && 
                card.getAttribute('image-url') === this._imageUrl) {
                // If this is a newer card (higher index), remove the old one
                if (currentIndex > index) {
                    card.remove();
                }
            }
        });
    }

    getImageData() {
        return {
            imageUrl: this._imageUrl,
            prompt: this._prompt,
            timestamp: new Date().toISOString()
        };
    }

    render() {
        const upscaleButton = this._isUpscaled ? '' : `
            <button class="menu-button" data-action="upscale" title="Upscale Image">
                <img src="/images/icons/ph-arrow-square-up-right-light.svg" />
                Upscale
            </button>
        `;

        const hdBadge = this._isUpscaled ? `
            <div class="hd-badge">
                <img src="/images/icons/ph-arrow-square-up-right-light.svg" />
                HD
            </div>
        ` : '';

        const template = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .image-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    border-radius: 8px;
                }

                img.generation-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .menu-overlay {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    background: linear-gradient(to left, rgba(0,0,0,0.5), transparent);
                }

                .image-container:hover .menu-overlay {
                    opacity: 1;
                }

                .menu-button {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.9);
                    color: #333;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                    min-width: 100px;
                    justify-content: flex-start;
                }

                .menu-button:hover {
                    background: rgba(255, 255, 255, 1);
                    transform: translateY(-1px);
                }

                .menu-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .menu-button img {
                    width: 16px;
                    height: 16px;
                }

                .menu-button[data-action="delete"]:hover {
                    background: rgba(255, 100, 100, 0.9);
                    color: white;
                }

                .menu-button[data-action="delete"]:hover img {
                    filter: brightness(0) invert(1);
                }

                .hd-badge {
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    background: rgba(255, 255, 255, 0.9);
                    color: #333;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    z-index: 10;
                }

                .hd-badge img {
                    width: 14px;
                    height: 14px;
                }
            </style>
            <div class="image-container">
                <img class="generation-image" src="${this._imageUrl}" alt="${this._prompt || 'Generated image'}" />
                ${hdBadge}
                <div class="menu-overlay">
                    ${upscaleButton}
                    <button class="menu-button" data-action="collection" title="Add to Collection">
                        <img src="/images/icons/ph-folder-simple-plus-light.svg" />
                        Add
                    </button>
                    <button class="menu-button" data-action="download" title="Download Image">
                        <img src="/images/icons/ph-download-simple-light.svg" />
                        Save
                    </button>
                    <button class="menu-button" data-action="prompt" title="View Prompt">
                        <img src="/images/icons/ph-file-code-light.svg" />
                        Prompt
                    </button>
                    <button class="menu-button" data-action="delete" title="Delete Image">
                        <img src="/images/icons/ph-trash-light.svg" />
                        Delete
                    </button>
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = template;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const container = this.shadowRoot.querySelector('.image-container');
        if (!container) return;

        // Add click handlers for all menu buttons
        container.querySelectorAll('.menu-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                
                switch (action) {
                    case 'upscale':
                        await this.handleUpscale();
                        break;
                    case 'collection':
                        this.handleAddToCollection();
                        break;
                    case 'download':
                        await this.handleDownload();
                        break;
                    case 'prompt':
                        this.handleShowPrompt();
                        break;
                    case 'delete':
                        this.handleDelete();
                        break;
                }
            });
        });
    }

    handleAddToCollection() {
        // Get the collection modal
        let collectionModal = document.querySelector('collection-modal');
        if (!collectionModal) {
            collectionModal = document.createElement('collection-modal');
            document.body.appendChild(collectionModal);
        }

        // Set the image data
        collectionModal.setImageData({
            imageUrl: this._imageUrl,
            prompt: this._prompt,
            generationId: this._id
        });

        // Show the modal
        collectionModal.show();
    }

    handleShowPrompt() {
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show(this._prompt || 'No prompt available', 'info', 5000);
    }

    async handleDownload() {
        try {
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Preparing download...', 'info', 5000);

            const response = await fetch(`/api/download?imageUrl=${encodeURIComponent(this._imageUrl)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to download image');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `image-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            const successToast = document.createElement('toast-notification');
            document.body.appendChild(successToast);
            successToast.show('Download complete!', 'success', 5000);
        } catch (error) {
            console.error('Download error:', error);
            const errorToast = document.createElement('toast-notification');
            document.body.appendChild(errorToast);
            errorToast.show('Failed to download image', 'error', 5000);
        }
    }

    handleDelete() {
        if (confirm('Are you sure you want to delete this image?')) {
            // Dispatch delete event
            const event = new CustomEvent('deleteImage', {
                bubbles: true,
                composed: true,
                detail: {
                    imageUrl: this._imageUrl,
                    generationId: this._id
                }
            });
            this.dispatchEvent(event);
        }
    }

    async handleUpscale() {
        const upscaleButton = this.shadowRoot.querySelector('.menu-button[data-action="upscale"]');
        if (!upscaleButton) return;

        try {
            upscaleButton.disabled = true;
            const loadingHtml = `
                <img src="/images/icons/ph-arrow-square-up-right-light.svg" />
                Upscaling...
            `;
            upscaleButton.innerHTML = loadingHtml;
            
            const response = await fetch('/api/images/upscale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: this._imageUrl
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.details || 'Failed to upscale image');
            }
            
            // Update the component state
            this.setAttribute('image-url', data.imageUrl);
            this.setAttribute('is-upscaled', 'true');
            this._isUpscaled = true;
            
            // Force image reload by adding a timestamp
            const img = this.shadowRoot.querySelector('img');
            if (img) {
                const timestamp = new Date().getTime();
                img.src = `${data.imageUrl}?t=${timestamp}`;
            }

            // Show success toast
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Image upscaled successfully!', 'success', 5000);

            // Dispatch event to notify parent components
            this.dispatchEvent(new CustomEvent('imageUpscaled', {
                bubbles: true,
                composed: true,
                detail: {
                    generationId: this._id,
                    newImageUrl: data.imageUrl,
                    isUpscaled: true
                }
            }));

            // Force re-render to update UI
            this.render();

        } catch (error) {
            console.error('Error upscaling image:', error);
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show(error.message || 'Failed to upscale image. Please try again.', 'error', 5000);
        } finally {
            if (upscaleButton) {
                upscaleButton.disabled = false;
                upscaleButton.innerHTML = `
                    <img src="/images/icons/ph-arrow-square-up-right-light.svg" />
                    Upscale
                `;
            }
        }
    }

    connectedCallback() {
        // Check if image is upscaled based on URL when component is connected
        if (this._imageUrl && this._imageUrl.includes('/upscaled/')) {
            this._isUpscaled = true;
            this.setAttribute('is-upscaled', 'true');
        }
        this.render();
        this.setupEventListeners();
    }
}

customElements.define('generation-card', GenerationCard);

// Listen for collection creation to add pending image
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('collectionCreated', async (e) => {
        const pendingGenerationId = window.localStorage.getItem('pendingGenerationId');
        if (pendingGenerationId && e.detail.collection) {
            try {
                await fetch(`/api/collections/${e.detail.collection._id}/images`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ generationId: pendingGenerationId })
                });
                window.localStorage.removeItem('pendingGenerationId');
            } catch (error) {
                console.error('Error adding image to new collection:', error);
            }
        }
    });
});
