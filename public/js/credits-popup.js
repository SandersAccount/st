// Credit packages configuration
const creditPackages = [
    { credits: 100, discount: 0, price: 10.00 },
    { credits: 200, discount: 4, price: 19.20 },
    { credits: 300, discount: 6, price: 28.20 },
    { credits: 500, discount: 8, price: 46.00 },
    { credits: 1000, discount: 10, price: 90.00 }
];

class CreditsPopup {
    constructor() {
        this.createPopupElement();
        this.setupEventListeners();
    }

    createPopupElement() {
        const popup = document.createElement('div');
        popup.className = 'credits-popup';
        popup.innerHTML = `
            <div class="credits-popup-content">
                <button class="close-button">&times;</button>
                <h2>Buy Credits</h2>
                <div class="credits-selection">
                    <input type="range" class="credits-slider" min="100" max="1000" step="100" value="100">
                    <div class="credits-info">
                        <span class="selected-credits">100</span> Credits
                    </div>
                    <div class="price-info">
                        <div class="price">
                            <span class="original-price">$10.00</span>
                            <span class="discount">0% OFF</span>
                        </div>
                        <div class="final-price">Final Price: $10.00</div>
                    </div>
                </div>
                <button class="buy-credits-button">Buy Now</button>
            </div>
        `;
        document.body.appendChild(popup);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .credits-popup {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                justify-content: center;
                align-items: center;
            }

            .credits-popup-content {
                background: #1E1E1E;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                padding: 24px;
                color: #fff;
            }

            .credits-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }

            .credits-popup-header h2 {
                margin: 0;
                font-size: 24px;
            }

            .close-button {
                background: none;
                border: none;
                color: #fff;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
            }

            .credits-slider-container {
                margin-bottom: 24px;
            }

            .credits-slider {
                width: 100%;
                margin-bottom: 12px;
            }

            .credits-value {
                text-align: center;
                font-size: 18px;
            }

            .selected-credits {
                font-weight: bold;
                color: #ff1cf7;
            }

            .credits-info {
                background: #2A2A2A;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
            }

            .price-info {
                text-align: center;
            }

            .original-price {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .discount {
                color: #ff1cf7;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .final-price {
                font-size: 18px;
            }

            .buy-credits-button {
                width: 100%;
                background: #ff1cf7;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 12px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .buy-credits-button:hover {
                background: #ff45f9;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        const popup = document.querySelector('.credits-popup');
        const closeButton = popup.querySelector('.close-button');
        const slider = popup.querySelector('.credits-slider');
        const buyButton = popup.querySelector('.buy-credits-button');

        closeButton.addEventListener('click', () => this.hide());
        popup.addEventListener('click', (e) => {
            if (e.target === popup) this.hide();
        });

        slider.addEventListener('input', (e) => {
            const credits = parseInt(e.target.value);
            const selectedPackage = creditPackages.find(p => p.credits === credits);
            
            popup.querySelector('.selected-credits').textContent = credits;
            popup.querySelector('.original-price').textContent = `$${selectedPackage.price.toFixed(2)}`;
            popup.querySelector('.discount').textContent = `${selectedPackage.discount}% OFF`;
            
            const finalPrice = selectedPackage.price * (1 - selectedPackage.discount / 100);
            popup.querySelector('.final-price').textContent = `Final Price: $${finalPrice.toFixed(2)}`;
        });

        buyButton.addEventListener('click', async () => {
            const credits = parseInt(slider.value);
            const selectedPackage = creditPackages.find(p => p.credits === credits);
            
            if (!selectedPackage) {
                alert('Please select a valid credit package');
                return;
            }

            try {
                const response = await fetch('/api/credits/purchase', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ credits })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to process credit purchase');
                }

                const data = await response.json();
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    this.hide();
                    alert('Thank you for your purchase! Your credits will be added soon.');
                }
            } catch (error) {
                console.error('Error purchasing credits:', error);
                alert(error.message || 'Failed to process credit purchase. Please try again.');
            }
        });
    }

    show() {
        const popup = document.querySelector('.credits-popup');
        popup.style.display = 'flex';
    }

    hide() {
        const popup = document.querySelector('.credits-popup');
        popup.style.display = 'none';
    }
}

// Initialize the popup
const creditsPopup = new CreditsPopup();

// Export for use in other files
export default creditsPopup;
