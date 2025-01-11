export function createCollectionCard(collection) {
    const card = document.createElement('a');
    card.className = 'collection-card';
    card.href = `/collection/${collection._id}`;
    card.dataset.collectionId = collection._id;
    
    // Create thumbnail grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'collection-grid-container';

    // Create main thumbnail
    const mainThumbnail = document.createElement('div');
    mainThumbnail.className = 'main-thumbnail';
    
    if (collection.recentImages && collection.recentImages.length > 0) {
        const mainImg = document.createElement('img');
        mainImg.src = collection.recentImages[0];
        mainImg.alt = collection.title;
        mainImg.dataset.imageUrl = collection.recentImages[0];
        mainThumbnail.appendChild(mainImg);
    } else {
        mainThumbnail.innerHTML = '<i class="fas fa-images"></i>';
        mainThumbnail.classList.add('empty');
    }
    
    // Create smaller thumbnails container
    const smallThumbnails = document.createElement('div');
    smallThumbnails.className = 'small-thumbnails';
    
    // Add up to 3 more thumbnails
    for (let i = 1; i < 4; i++) {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'small-thumbnail';
        
        if (collection.recentImages && collection.recentImages[i]) {
            const img = document.createElement('img');
            img.src = collection.recentImages[i];
            img.alt = `${collection.title} thumbnail ${i + 1}`;
            img.dataset.imageUrl = collection.recentImages[i];
            thumbContainer.appendChild(img);
        } else {
            thumbContainer.classList.add('empty');
        }
        
        smallThumbnails.appendChild(thumbContainer);
    }

    gridContainer.appendChild(mainThumbnail);
    gridContainer.appendChild(smallThumbnails);

    const info = document.createElement('div');
    info.className = 'collection-info';
    
    const title = document.createElement('h3');
    title.className = 'collection-title';
    title.textContent = collection.title;

    const count = document.createElement('div');
    count.className = 'collection-count';
    count.textContent = `${collection.imageCount || 0} images`;

    info.appendChild(title);
    info.appendChild(count);

    card.appendChild(gridContainer);
    card.appendChild(info);

    // Listen for image deletion events
    window.addEventListener('imageDeleted', (e) => {
        const deletedImageId = e.detail.generationId;
        
        // Find all thumbnails in this collection
        const thumbnails = card.querySelectorAll('img[data-image-url]');
        
        // Check each thumbnail
        thumbnails.forEach(async (thumbnail) => {
            const imageUrl = thumbnail.dataset.imageUrl;
            if (!imageUrl) return;

            try {
                // Get the generation ID from the image URL
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                const generationId = filename.split('.')[0]; // Assuming URL format ends with generationId.png
                
                // If this thumbnail matches the deleted image
                if (generationId === deletedImageId) {
                    // Add fade-out animation
                    thumbnail.style.transition = 'opacity 0.3s ease';
                    thumbnail.style.opacity = '0';
                    
                    // After animation, update collection card
                    setTimeout(async () => {
                        try {
                            // Fetch updated collection data
                            const response = await fetch(`/api/collections/${collection._id}`, {
                                credentials: 'include'
                            });
                            if (!response.ok) throw new Error('Failed to fetch collection');
                            
                            const updatedCollection = await response.json();
                            
                            // Update the image count
                            const countElement = card.querySelector('.collection-count');
                            if (countElement) {
                                countElement.textContent = `${updatedCollection.images.length} images`;
                            }

                            // Get the parent container
                            const container = thumbnail.parentElement;
                            
                            // If no images left, show placeholder
                            if (updatedCollection.images.length === 0) {
                                mainThumbnail.innerHTML = '<i class="fas fa-images"></i>';
                                mainThumbnail.classList.add('empty');
                                smallThumbnails.querySelectorAll('.small-thumbnail').forEach(thumb => {
                                    thumb.innerHTML = '';
                                    thumb.classList.add('empty');
                                });
                            }
                            // If there are images but this was the main thumbnail
                            else if (container === mainThumbnail && updatedCollection.images.length > 0) {
                                // Replace with the next available image
                                thumbnail.src = updatedCollection.images[0].imageData;
                                thumbnail.dataset.imageUrl = updatedCollection.images[0].imageData;
                                thumbnail.style.opacity = '1';
                            }
                            // If it was a small thumbnail, just remove it and update the grid
                            else if (container.classList.contains('small-thumbnail')) {
                                container.innerHTML = '';
                                container.classList.add('empty');
                            }
                        } catch (error) {
                            console.error('Error updating collection card:', error);
                        }
                    }, 300);
                }
            } catch (error) {
                console.error('Error processing thumbnail:', error);
            }
        });
    });

    return card;
}

export function createNewCollectionCard(onClick) {
    const card = document.createElement('div');
    card.className = 'collection-card new-collection';
    
    const placeholder = document.createElement('div');
    placeholder.className = 'collection-placeholder';
    placeholder.innerHTML = `
        <span>+</span>
        <p>Create New Collection</p>
    `;
    
    card.appendChild(placeholder);
    card.addEventListener('click', onClick);
    
    return card;
}
