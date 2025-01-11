document.addEventListener('DOMContentLoaded', () => {
    createTopbar(); 
    loadCollections();
    loadGenerations();
    setupCollectionModal();
});

function setupCollectionModal() {
    const modal = document.getElementById('newCollectionModal');
    const form = document.getElementById('newCollectionForm');
    const cancelBtn = document.getElementById('cancelCollectionBtn');

    // Close modal when clicking cancel
    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('collectionTitle').value;
        
        try {
        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
                body: JSON.stringify({ title })
            });

            if (!response.ok) throw new Error('Failed to create collection');
            
            const collection = await response.json();
            modal.classList.remove('active');
            form.reset();
            loadCollections(); // Refresh collections
        } catch (error) {
            console.error('Error creating collection:', error);
        }
    });
}

async function loadCollections() {
    try {
        const response = await fetch('/api/collections', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load collections');
        
        const collections = await response.json();
        displayCollections(collections);
    } catch (error) {
        console.error('Error loading collections:', error);
    }
}

function displayCollections(collections) {
    const container = document.querySelector('.collections-grid');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Add "Create New Collection" card first
    container.appendChild(createNewCollectionCard());

    // Add collection cards
    collections.forEach(collection => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        
        // Create preview grid
        const previewGrid = document.createElement('div');
        previewGrid.className = 'preview-grid';

        // Add up to 4 preview images
        const previewImages = collection.images.slice(0, 4);
        previewImages.forEach(image => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'preview-image';
            
            const img = document.createElement('img');
            img.src = image.imageUrl;
            img.alt = collection.title;
            img.loading = 'lazy';
            
            imgContainer.appendChild(img);
            previewGrid.appendChild(imgContainer);
        });

        // Fill remaining slots with empty previews
        for (let i = previewImages.length; i < 4; i++) {
            const emptyPreview = document.createElement('div');
            emptyPreview.className = 'preview-image empty';
            previewGrid.appendChild(emptyPreview);
        }

        card.appendChild(previewGrid);

        // Add collection info
        const info = document.createElement('div');
        info.className = 'collection-info';
        info.innerHTML = `
            <h3>${collection.title}</h3>
            <span>${collection.stats?.imageCount || 0} images</span>
        `;
        card.appendChild(info);

        // Make the card clickable
        card.addEventListener('click', () => {
            window.location.href = `/collection/${collection._id}`;
        });

        container.appendChild(card);
    });
}

function createNewCollectionCard() {
    const card = document.createElement('div');
    card.className = 'collection-card new-collection';
    
    const icon = document.createElement('div');
    icon.className = 'collection-icon';
    icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;

    const title = document.createElement('div');
    title.className = 'collection-title';
    title.textContent = 'Create New Collection';

    card.appendChild(icon);
    card.appendChild(title);

    card.addEventListener('click', () => {
        document.getElementById('newCollectionModal').classList.add('active');
    });

    return card;
}

async function loadGenerations() {
    try {
        const response = await fetch('/api/generations', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load generations');
        
        const generations = await response.json();
        const collections = await fetch('/api/collections', {
            credentials: 'include'
        }).then(res => res.json());
        displayGenerations(generations, collections);
    } catch (error) {
        console.error('Error loading generations:', error);
    }
}

function displayGenerations(generations, collections) {
    const grid = document.querySelector('.generations-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    const collectionImageUrls = new Set();
    collections.forEach(collection => {
        if (collection.images) {
            collection.images.forEach(image => collectionImageUrls.add(image.imageUrl));
        }
    });

    const displayedImageUrls = new Set();
    generations.forEach(generation => {
        if (!collectionImageUrls.has(generation.imageUrl) && !displayedImageUrls.has(generation.imageUrl)) {
            console.log('Creating card for generation:', generation);
            const card = document.createElement('generation-card');
            console.log('Card created, setting attributes...');
            card.setAttribute('image-url', generation.imageUrl);
            card.setAttribute('prompt', generation.prompt || '');
            console.log('Attributes set:', {
                imageUrl: card.getAttribute('image-url'),
                prompt: card.getAttribute('prompt')
            });
            grid.appendChild(card);
            displayedImageUrls.add(generation.imageUrl);
            console.log('Card appended to grid');
        }
    });
}

// Handle new collection creation
document.querySelector('.new-collection')?.addEventListener('click', () => {
    // TODO: Implement collection creation modal
    console.log('Create new collection clicked');
});

export function handleAddToCollection(imageData) {
    const collectionModal = document.querySelector('collection-modal');
    if (!collectionModal) {
        console.error('Collection modal not found');
        return;
    }

    // Set the image data and show the modal
    collectionModal.setImageData(imageData);
    collectionModal.show();

    // Log for debugging
    console.log('Showing collection modal with image data:', imageData);
}

export async function addToExistingCollection(collectionId, imageData) {
    try {
        const response = await fetch(`/api/collections/${collectionId}/images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(imageData),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to add image to collection');
        }

        // Create and show a success toast
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Image added to collection', 'success');

        // Dispatch event to refresh collections
        window.dispatchEvent(new CustomEvent('imageAddedToCollection'));
    } catch (error) {
        console.error('Error:', error);
        const toast = document.createElement('toast-notification');
        document.body.appendChild(toast);
        toast.show('Failed to add image to collection', 'error');
    }
}

function createImageOptionsDropdown(generation) {
    const dropdown = document.createElement('select');
    dropdown.className = 'image-options-dropdown';
    dropdown.innerHTML = `
        <option value="prompt">Prompt</option>
        <option value="add-to-collection">Add to Collection</option>
        <option value="download">Download</option>
        <option value="upscale">Upscale</option>
        <option value="move-to-trash">Move to Trash</option>
    `;
    dropdown.addEventListener('change', (e) => {
        const selectedOption = e.target.value;
        switch (selectedOption) {
            case 'prompt':
                handlePrompt(generation);
                break;
            case 'add-to-collection':
                handleAddToCollection(generation);
                break;
            case 'download':
                handleDownload(generation);
                break;
            case 'upscale':
                handleUpscale(generation);
                break;
            case 'move-to-trash':
                handleMoveToTrash(generation);
                break;
        }
    });
    return dropdown;
};

// Placeholder functions for dropdown options
function handlePrompt(generation) {
    console.log('Prompt selected', generation);
    // Add your prompt handling logic here
};

function handleAddToCollection(generation) {
    console.log('Add to Collection selected', generation);
    const collectionModal = document.querySelector('collection-modal');
    if (!collectionModal) {
        console.error('Collection modal not found');
        return;
    }
    collectionModal.setImageData({
        imageUrl: generation.imageUrl,
        prompt: generation.prompt
    });
    collectionModal.show();
};

function handleDownload(generation) {
    console.log('Download selected', generation);
    // Add your download handling logic here
};

function handleUpscale(generation) {
    console.log('Upscale selected', generation);
    // Add your upscale handling logic here
};

function handleMoveToTrash(generation) {
    console.log('Move to Trash selected', generation);
    // Add your Move to Trash handling logic here
};
