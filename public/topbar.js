// Create and inject the topbar
class Topbar extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
            window.location.href = '/login';
             return;
        }
         const userData = await response.json();
        
        this.innerHTML = `
            <div class="topbar">
                <div class="logo">
                    <a href="/">Sticker Generator</a>
                </div>
                <div class="profile-section">
                    <div class="profile-trigger" id="profileTrigger">
                        <div class="profile-avatar">
                            ${this.getInitials(userData.name)}
                        </div>
                    </div>
                    <div class="profile-dropdown" id="profileDropdown">
                        <div class="dropdown-header">
                            <div class="user-info">
                                <div class="profile-avatar">${this.getInitials(userData.name)}</div>
                                <div class="user-details">
                                    <div class="user-name">${userData.name}</div>
                                    <div class="user-email">${userData.email}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="upgrade-banner">
                            <div class="banner-content">
                                <div class="plan-info">
                                    <div class="plan-name">Basic Plan</div>
                                    <div class="plan-description">Upgrade to unlock all the premium features & resources</div>
                                </div>
                                <button class="upgrade-button">Upgrade with 20% OFF</button>
                            </div>
                        </div>

                        <div class="dropdown-menu">
                            <a href="/profile" class="menu-item">
                                <i class="fas fa-user"></i>
                                Personal Info
                            </a>
                            <a href="/profile?tab=subscription" class="menu-item">
                                <i class="fas fa-crown"></i>
                                Subscription
                            </a>
                            <a href="/profile?tab=credits" class="menu-item">
                                <i class="fas fa-coins"></i>
                                Credits
                            </a>
                        </div>

                        <div class="dropdown-footer">
                            <a href="#" class="menu-item" id="signOutButton">
                                <i class="fas fa-sign-out-alt"></i>
                                Sign Out
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initializeDropdown();
        this.initializeSignOut();
    }

    getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
    }

    initializeDropdown() {
        const trigger = this.querySelector('#profileTrigger');
        const dropdown = this.querySelector('#profileDropdown');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    initializeSignOut() {
        const signOutButton = this.querySelector('#signOutButton');
        signOutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }
}

customElements.define('top-bar', Topbar);

// Call createTopbar when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const topbar = document.createElement('top-bar');
    document.body.insertBefore(topbar, document.body.firstChild);
});
