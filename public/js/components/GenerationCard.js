import { CollectionSelector } from './CollectionSelector.js';
import { showToast } from './Toast.js';

export class GenerationCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageUrl = '';
        this._prompt = '';
        this._isUpscaled = false;
        this._id = '';
        this._isUpscaling = false;
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
                <img src="/images/ph--arrow-square-up-right-light.svg" />
                Upscale Image
            </button>
        `;

        const hdBadge = this._isUpscaled ? `
            <div class="hd-badge">
                <img src="/images/ph--arrow-square-up-right-light.svg" />
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
                        <img src="/images/ph--folder-simple-plus-light.svg" />
                        Add to Collection
                    </button>
                    <button class="menu-button" data-action="download" title="Download Image">
                        <img src="/images/ph--download-simple-light.svg" />
                        Download
                    </button>
                    <button class="menu-button" data-action="bgremove" title="Remove Background">
                        <img src="/images/ph--images-square-light.svg" />
                        BG Remove
                    </button>
                    <button class="menu-button" data-action="edit" title="Edit in Sticker Editor">
                        <img src="/images/ph--pencil-line-light%20(1).svg" />
                        Edit
                    </button>
                    <button class="menu-button" data-action="delete" title="Delete Image">
                        <img src="/images/ph--trash-light.svg" />
                        Delete Image
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
                    case 'bgremove':
                        await this.handleBgRemove();
                        break;
                    case 'edit':
                        this.handleEdit();
                        break;
                    case 'delete':
                        await this.handleDelete();
                        break;
                }
            });
        });
    }

    async handleUpscale() {
        if (this._isUpscaling) return;

        const upscaleButton = this.shadowRoot.querySelector('.menu-button[data-action="upscale"]');
        if (!upscaleButton) {
            console.error('Upscale button not found');
            return;
        }

        try {
            this._isUpscaling = true;
            upscaleButton.disabled = true;
            upscaleButton.innerHTML = `
                <img src="/images/ph--arrow-square-up-right-light.svg" />
                Upscaling...
            `;

            // Get user data to check hideCredits status
            const userResponse = await fetch('/api/auth/user', {
                credentials: 'include'
            });
            const userData = await userResponse.json();

            const response = await fetch('/api/images/upscale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: this._imageUrl
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.status === 403) {
                if (data.error === 'Not enough credits' && !userData.hideCredits) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = 'You need credits to upscale images. Please purchase credits to continue.';
                    
                    const buyButton = document.createElement('button');
                    buyButton.textContent = 'Buy Credits';
                    buyButton.className = 'btn-primary';
                    buyButton.onclick = () => window.location.href = '/profile?tab=credits';
                    
                    errorDiv.appendChild(document.createElement('br'));
                    errorDiv.appendChild(buyButton);
                    
                    this.shadowRoot.appendChild(errorDiv);
                    return;
                }
            }

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Failed to upscale image');
            }

            // Update the component state
            this.setAttribute('image-url', data.imageUrl);
            this.setAttribute('is-upscaled', 'true');
            this._isUpscaled = true;
            this._imageUrl = data.imageUrl;
            
            // Force image reload by adding a timestamp
            const img = this.shadowRoot.querySelector('img');
            if (img) {
                const timestamp = new Date().getTime();
                img.src = `${data.imageUrl}?t=${timestamp}`;
            }

            // Update credits display only if not hidden
            if (!userData.hideCredits) {
                const creditsElement = document.getElementById('topbarCredits');
                if (creditsElement && data.credits !== undefined) {
                    creditsElement.textContent = data.credits === 123654 ? 'Unlimited' : data.credits;
                }
            }

            // Show success toast
            showToast('Image upscaled successfully!', 'success');

            // Hide upscale button since image is now upscaled
            upscaleButton.style.display = 'none';

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
            showToast('Failed to upscale image. Please try again.', 'error');
            
            // Show error message in the card
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = error.message;
            this.shadowRoot.appendChild(errorDiv);
        } finally {
            this._isUpscaling = false;
            if (upscaleButton) {
                upscaleButton.disabled = false;
                upscaleButton.innerHTML = `
                    <img src="/images/ph--arrow-square-up-right-light.svg" />
                    Upscale Image
                `;
            }
        }
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
        showToast(this._prompt || 'No prompt available', 'info');
    }

    async handleDownload() {
        try {
            showToast('Preparing download...', 'info');

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

            showToast('Download complete!', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Failed to download image', 'error');
        }
    }

    async handleDelete() {
        try {
            const response = await fetch(`/api/images/${this._id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.remove();
            } else {
                console.error('Failed to delete image');
            }
        } catch (error) {
            console.error('Error deleting image:', error);
        }
    }

    handleEdit() {
        // Redirect to sticker editor with the image URL
        const editorUrl = new URL('/sticker-editor.html', window.location.origin);
        editorUrl.searchParams.set('image', this._imageUrl);
        window.location.href = editorUrl.toString();
    }

    async handleBgRemove() {
        const bgRemoveButton = this.shadowRoot.querySelector('.menu-button[data-action="bgremove"]');
        if (!bgRemoveButton) return;

        try {
            bgRemoveButton.disabled = true;
            const loadingHtml = `
                <img src="/images/ph--images-square-light.svg" />
                Removing BG...
            `;
            bgRemoveButton.innerHTML = loadingHtml;
            
            const response = await fetch('/api/images/bgremove', {
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
                throw new Error(data.error || data.details || 'Failed to remove background');
            }

            // Update the image with the background removed version
            this._imageUrl = data.imageUrl;
            this.setAttribute('image-url', data.imageUrl);
            
            // Reset button state
            bgRemoveButton.disabled = false;
            bgRemoveButton.innerHTML = `
                <img src="/images/ph--images-square-light.svg" />
                BG Remove
            `;

        } catch (error) {
            console.error('Error removing background:', error);
            bgRemoveButton.disabled = false;
            bgRemoveButton.innerHTML = `
                <img src="/images/ph--images-square-light.svg" />
                BG Remove
            `;
            showToast(error.message, 'error');
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

// Define the custom element
if (!customElements.get('generation-card')) {
    customElements.define('generation-card', GenerationCard);
}

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
