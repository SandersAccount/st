import { CollectionSelector } from './CollectionSelector.js';

export class GenerationCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageUrl = '';
        this._prompt = '';
        this.render();
    }

    static get observedAttributes() {
        return ['image-url', 'prompt'];
    }

    connectedCallback() {
        this.setupEventListeners();
        this.checkAndRemoveDuplicate();
    }

    get imageUrl() {
        return this._imageUrl;
    }

    set imageUrl(value) {
        this._imageUrl = value;
        this.setAttribute('image-url', value);
        this.render();
        this.checkAndRemoveDuplicate();
    }

    get prompt() {
        return this._prompt;
    }

    set prompt(value) {
        this._prompt = value;
        this.setAttribute('prompt', value);
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (name === 'image-url') this._imageUrl = newValue;
            if (name === 'prompt') this._prompt = newValue;
            this.render();
            if (name === 'image-url') this.checkAndRemoveDuplicate();
        }
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
        this.shadowRoot.innerHTML = `
            <style>
                .card {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #1a1a1a;
                }

                .image-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    cursor: pointer;
                }

                .image-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0;
                    transition: opacity 0.3s ease-out;
                }

                .image-options-dropdown {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    z-index: 10;
                }

                .dropdown-button {
                    background: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 18px;
                }

                .dropdown-content {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background: #2a2a2a;
                    border-radius: 8px;
                    min-width: 160px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                }

                .dropdown-content.show {
                    display: block;
                }

                .dropdown-content div {
                    color: white;
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .dropdown-content div:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .dropdown-content div[data-action="move-to-trash"] {
                    color: #ff4444;
                }
            </style>
            <div class="card" data-id="${this._imageUrl}">
                <div class="image-container">
                    <img src="${this.normalizeImageUrl(this._imageUrl)}" 
                         alt="${this._prompt || 'Generated image'}" 
                         loading="lazy"
                         onload="this.style.opacity = 1"
                         onerror="this.style.opacity = 0.5; this.style.background = '#2a2a2a';">
                    <div class="image-options-dropdown">
                        <button class="dropdown-button">⋮</button>
                        <div class="dropdown-content">
                            <div data-action="prompt">Show Prompt</div>
                            <div data-action="add-to-collection">Add to Collection</div>
                            <div data-action="download">Download</div>
                            <div data-action="upscale">Upscale</div>
                            <div data-action="move-to-trash">Move to Trash</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const dropdownButton = this.shadowRoot.querySelector('.dropdown-button');
        const dropdownContent = this.shadowRoot.querySelector('.dropdown-content');
        const optionsContainer = this.shadowRoot.querySelector('.image-options-dropdown');

        if (!dropdownButton || !dropdownContent || !optionsContainer) {
            console.error('Dropdown elements not found');
            return;
        }

        // Toggle dropdown
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Dropdown button clicked'); // Debug log
            dropdownContent.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!optionsContainer.contains(e.target)) {
                dropdownContent.classList.remove('show');
            }
        });

        // Handle dropdown options
        dropdownContent.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            if (!action) return;

            e.stopPropagation();
            console.log('Option clicked:', action); // Debug log
            dropdownContent.classList.remove('show');

            switch (action) {
                case 'prompt':
                    this.handlePrompt();
                    break;
                case 'add-to-collection':
                    this.handleAddToCollection();
                    break;
                case 'download':
                    this.handleDownload();
                    break;
                case 'upscale':
                    this.handleUpscale();
                    break;
                case 'move-to-trash':
                    this.handleMoveToTrash();
                    break;
            }
        });
    }

    handlePrompt() {
        // Extract the base prompt without the style
        const fullPrompt = this.getAttribute('prompt');
        
        // Don't show "No prompt available" in the toast
        if (fullPrompt === 'No prompt available') {
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('No prompt available', 'info', 3000);
            return;
        }

        const styleIndex = fullPrompt.toLowerCase().indexOf('style:');
        const basePrompt = styleIndex !== -1 ? fullPrompt.substring(0, styleIndex).trim() : fullPrompt;
        
        // Create and show toast
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show(basePrompt, 'info', 3000, 'Prompt:'); // Show with "Prompt:" title
    }

    handleAddToCollection() {
        console.log('Attempting to add to collection...'); // Debug log
        
        // Get or create the collection-modal component
        let collectionModal = document.querySelector('collection-modal');
        if (!collectionModal) {
            collectionModal = document.createElement('collection-modal');
            document.body.appendChild(collectionModal);
        }

        // Set the image data
        collectionModal.setImageData({
            imageUrl: this._imageUrl,
            prompt: this._prompt
        });

        // Show the modal
        collectionModal.show();
    }

    async handleDownload() {
        try {
            if (!this._imageUrl) {
                throw new Error('Image URL is missing');
            }

            // Show loading toast
            const loadingToast = document.createElement('toast-notification');
            document.body.appendChild(loadingToast);
            loadingToast.show('Preparing download...', 'info', 3000);

            // Use our server endpoint to handle the download
            const response = await fetch(`/api/download?imageUrl=${encodeURIComponent(this._imageUrl)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            const filename = filenameMatch ? filenameMatch[1] : `sticker-${Date.now()}.png`;

            // Convert response to blob
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);

            // Show success toast
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Download complete', 'success', 3000);
        } catch (error) {
            console.error('Download error:', error);
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Failed to download image. Please try again.', 'error', 3000);
        }
    }

    handleUpscale() {
        console.log('Upscale selected');
        // Add your upscale handling logic here
    }

    normalizeImageUrl(url) {
        // Ensure proper URL formatting
        if (!url) return '';
        
        // Fix common URL issues
        url = url.replace(/-webp$/, '.webp');
        url = url.replace(/-png$/, '.png');
        url = url.replace(/-jpg$/, '.jpg');
        url = url.replace(/-jpeg$/, '.jpeg');
        
        return url;
    }

    handleMoveToTrash() {
        console.log('handleMoveToTrash called'); // Debug log
        const isInCollection = this.hasAttribute('collection-id');

        if (isInCollection) {
            // If in collection, remove from collection
            const collectionId = this.getAttribute('collection-id');
            const imageId = this.getAttribute('image-id');
            
            fetch(`/api/collections/${collectionId}/images/${imageId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to remove from collection');
                this.setAttribute('hidden', '');
                const toast = document.createElement('toast-notification');
                document.body.appendChild(toast);
                toast.show('Image removed from collection', 'success', 3000);
            })
            .catch(error => {
                console.error('Error:', error);
                const toast = document.createElement('toast-notification');
                document.body.appendChild(toast);
                toast.show('Failed to remove from collection', 'error', 3000);
            });
        } else {
            // If in recent generations, just hide the card
            console.log('Hiding card from recent generations'); // Debug log
            this.setAttribute('hidden', '');
            const toast = document.createElement('toast-notification');
            document.body.appendChild(toast);
            toast.show('Image removed from recent generations', 'success', 3000);
        }
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
