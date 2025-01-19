import { createCollectionCard, createNewCollectionCard } from '../components/CollectionCard.js';
import { setupCollectionModal, showCollectionModal } from '../components/CollectionModal.js';
import { createImageCard } from '../components/ImageCard.js';

export class CollectionsPage {
    constructor() {
        this.setupEventListeners();
        this.initialize();
    }

    setupEventListeners() {
        // Listen for collection creation
        window.addEventListener('collectionCreated', () => {
            this.loadCollections();
        });

        // Listen for adding to collection
        window.addEventListener('imageAddedToCollection', () => {
            this.loadCollections();
        });

        // Listen for adding to collection
        window.addEventListener('addToCollection', (e) => {
            const generation = e.detail.generation;
            // Show collection selection UI
            console.log('Add to collection:', generation);
        });

        // Listen for new generations
        window.addEventListener('newGeneration', (e) => {
            this.loadGenerations(); // Refresh generations grid when new image is generated
        });
    }

    async initialize() {
        setupCollectionModal();
        await Promise.all([
            this.loadCollections(),
            this.loadGenerations()
        ]);
    }

    async loadCollections() {
        try {
            const response = await fetch('/api/collections', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load collections');
            
            const collections = await response.json();
            this.displayCollections(collections);
        } catch (error) {
            console.error('Error loading collections:', error);
        }
    }

    displayCollections(collections) {
        const grid = document.getElementById('collectionsGrid');
        grid.innerHTML = '';

        // Add "Create New Collection" card
        const newCollectionCard = createNewCollectionCard(() => {
            showCollectionModal();
        });
        grid.appendChild(newCollectionCard);

        // Add existing collections
        collections.forEach(collection => {
            const card = createCollectionCard(collection);
            grid.appendChild(card);
        });
    }

    async loadGenerations() {
        try {
            const response = await fetch('/api/generations', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load generations');
            
            const generations = await response.json();
            this.displayGenerations(generations);
        } catch (error) {
            console.error('Error loading generations:', error);
        }
    }

    displayGenerations(generations) {
        const container = document.getElementById('recent-generations-grid');
        if (!container) return;

        container.innerHTML = '';

        generations.forEach(generation => {
            const card = document.createElement('generation-card');
            card.setAttribute('image-url', generation.imageUrl);
            card.setAttribute('prompt', generation.prompt || 'No prompt available');
            card.setAttribute('generation-id', generation._id);
            card.setAttribute('is-upscaled', generation.isUpscaled ? 'true' : 'false');
            container.appendChild(card);
        });
    }
}
