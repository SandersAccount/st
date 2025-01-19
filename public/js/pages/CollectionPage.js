import { showToast } from '../components/Toast.js';

export class CollectionPage {
    constructor() {
        // Get collection ID from path
        this.collectionId = window.location.pathname.split('/').pop();
        if (!this.collectionId) {
            window.location.href = '/collections';
            return;
        }
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadCollection();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing collection page:', error);
            showToast('Failed to load collection', 'error');
        }
    }

    setupEventListeners() {
        // Listen for image deletion
        window.addEventListener('imageDeleted', () => {
            this.loadCollection();
        });

        // Listen for image upscale
        window.addEventListener('imageUpscaled', () => {
            this.loadCollection();
        });
    }

    async loadCollection() {
        try {
            const response = await fetch(`/api/collections/${this.collectionId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load collection');
            }
            
            const collection = await response.json();
            this.displayCollection(collection);
        } catch (error) {
            console.error('Error loading collection:', error);
            showToast('Failed to load collection', 'error');
        }
    }

    displayCollection(collection) {
        // Update title
        document.title = `${collection.title} - Collection`;
        const titleElement = document.getElementById('collection-title');
        if (titleElement) {
            titleElement.textContent = collection.title;
        }

        // Display images
        const grid = document.getElementById('collection-grid');
        if (!grid) return;

        grid.innerHTML = '';

        collection.images.forEach(image => {
            const card = document.createElement('generation-card');
            card.setAttribute('image-url', image.imageUrl);
            card.setAttribute('prompt', image.prompt || 'No prompt available');
            card.setAttribute('generation-id', image._id);
            // Check for upscaled images based on URL path
            const isUpscaled = image.imageUrl.includes('/upscaled/');
            card.setAttribute('is-upscaled', isUpscaled ? 'true' : 'false');
            grid.appendChild(card);
        });

        // Update stats
        const statsElement = document.getElementById('collection-stats');
        if (statsElement) {
            statsElement.textContent = `${collection.images.length} images`;
        }
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    new CollectionPage();
});
