export async function createTopbar() {
    let defaultSettings = {
        appName: 'Sticker Generator',
        useLogoInstead: false
    };

    try {
        // Get settings first
        let settings = defaultSettings;
        try {
            const settingsResponse = await fetch('/api/settings', {
                credentials: 'include'
            });
            if (settingsResponse.ok) {
                settings = await settingsResponse.json();
                console.log('Loaded settings:', settings);
            } else {
                console.warn('Failed to load settings, using defaults');
            }
        } catch (error) {
            console.warn('Error loading settings, using defaults:', error);
        }

        const topbar = document.createElement('div');
        topbar.className = 'topbar';

        const content = document.createElement('div');
        content.className = 'topbar-content';

        // Left section with logo/text
        const leftSection = document.createElement('div');
        leftSection.className = 'topbar-left';
        
        const appTitle = document.createElement('a');
        appTitle.href = '/';
        appTitle.className = 'logo';
        
        if (settings.useLogoInstead && settings.logoUrl) {
            console.log('Using logo:', settings.logoUrl);
            const logo = document.createElement('img');
            logo.src = settings.logoUrl;
            logo.alt = settings.appName || defaultSettings.appName;
            logo.style.height = '47px';
            logo.style.width = 'auto';
            appTitle.appendChild(logo);
        } else {
            console.log('Using text:', settings.appName);
            appTitle.textContent = settings.appName || defaultSettings.appName;
        }
        
        leftSection.appendChild(appTitle);

        // Center section with navigation
        const centerSection = document.createElement('div');
        centerSection.className = 'topbar-center';

        const navItems = [
            { text: 'Prompt Sticker', href: '/' },
            { text: 'Image Sticker', href: '/face-sticker.html' },
            { text: 'Sticker Editor', href: '/sticker-editor.html' },
            { text: 'Collections', href: '/collections' }
        ];

        navItems.forEach(item => {
            const link = document.createElement('a');
            link.href = item.href;
            link.className = 'nav-link';
            if (window.location.pathname === item.href || 
                (item.href === '/collections' && window.location.pathname.startsWith('/collection/')) ||
                (item.href === '/face-sticker.html' && window.location.pathname.endsWith('face-sticker.html'))) {
                link.classList.add('active');
            }
            link.textContent = item.text;
            centerSection.appendChild(link);
        });

        // Right section with user info
        const rightSection = document.createElement('div');
        rightSection.className = 'topbar-right';

        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                // If auth fails, create minimal topbar with login button
                const loginButton = document.createElement('a');
                loginButton.href = '/login';
                loginButton.className = 'btn-login';
                loginButton.textContent = 'Login';
                rightSection.appendChild(loginButton);
            } else {
                const userData = await response.json();
                const user = userData.user;

                if (user) {
                    // Credits indicator
                    const creditsIndicator = document.createElement('div');
                    creditsIndicator.className = 'credits-indicator';

                    const creditsIcon = document.createElement('i');
                    creditsIcon.className = 'fas fa-coins';

                    const creditsCount = document.createElement('span');
                    creditsCount.textContent = user.credits || '0';
                    creditsCount.id = 'topbarCredits';

                    creditsIndicator.appendChild(creditsIcon);
                    creditsIndicator.appendChild(creditsCount);

                    // Upgrade button
                    const upgradeButton = document.createElement('button');
                    upgradeButton.className = 'btn-upgrade';
                    upgradeButton.textContent = 'Buy Credits';
                    upgradeButton.addEventListener('click', () => {
                        window.location.href = '/profile?tab=credits';
                    });

                    // User menu button
                    const userButton = document.createElement('button');
                    userButton.className = 'user-menu-button';

                    const avatar = document.createElement('div');
                    avatar.className = 'user-avatar';
                    avatar.textContent = user.name ? user.name[0].toUpperCase() : 'U';

                    userButton.appendChild(avatar);

                    // Create dropdown menu
                    const dropdown = document.createElement('div');
                    dropdown.className = 'user-dropdown';
                    dropdown.style.display = 'none';
                    dropdown.innerHTML = `
                        <div class="user-dropdown-content">
                            <div class="menu-header">
                                <div class="user-info">
                                    <div class="user-avatar">${user.name ? user.name[0].toUpperCase() : 'U'}</div>
                                    <div class="user-details">
                                        <div class="user-name">${user.name || 'User'}</div>
                                        <div class="user-email">${user.email}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="menu-items">
                                <a href="/profile" class="menu-item">
                                    <i class="fas fa-user"></i>
                                    Profile
                                </a>
                                <a href="/profile?tab=credits" class="menu-item">
                                    <i class="fas fa-coins"></i>
                                    Credits
                                </a>
                                <div class="menu-divider"></div>
                                <a href="#" class="menu-item" onclick="handleLogout(event)">
                                    <i class="fas fa-sign-out-alt"></i>
                                    Log Out
                                </a>
                            </div>
                        </div>
                    `;

                    // Add click handler for user menu
                    userButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                    });

                    // Close dropdown when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!dropdown.contains(e.target) && !userButton.contains(e.target)) {
                            dropdown.style.display = 'none';
                        }
                    });

                    // Add logout handler
                    window.handleLogout = async (event) => {
                        event.preventDefault();
                        try {
                            const response = await fetch('/api/auth/logout', {
                                method: 'POST',
                                credentials: 'include'
                            });
                            if (response.ok) {
                                window.location.href = '/auth';
                            }
                        } catch (error) {
                            console.error('Logout failed:', error);
                        }
                    };

                    const userMenuContainer = document.createElement('div');
                    userMenuContainer.className = 'user-menu-container';
                    userMenuContainer.style.position = 'relative';
                    userMenuContainer.appendChild(userButton);
                    userMenuContainer.appendChild(dropdown);

                    // Add components to right section
                    rightSection.appendChild(creditsIndicator);
                    rightSection.appendChild(upgradeButton);
                    rightSection.appendChild(userMenuContainer);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            // Create minimal topbar with login button
            const loginButton = document.createElement('a');
            loginButton.href = '/login';
            loginButton.className = 'btn-login';
            loginButton.textContent = 'Login';
            rightSection.appendChild(loginButton);
        }

        // Assemble topbar
        content.appendChild(leftSection);
        content.appendChild(centerSection);
        content.appendChild(rightSection);
        topbar.appendChild(content);

        // Add topbar to document
        document.body.insertBefore(topbar, document.body.firstChild);
        return topbar;
    } catch (error) {
        console.error('Error creating topbar:', error);
        // Create minimal topbar on error
        const minimalTopbar = document.createElement('div');
        minimalTopbar.className = 'topbar';
        minimalTopbar.innerHTML = `
            <div class="topbar-content">
                <div class="topbar-left">
                    <a href="/" class="logo">Sticker Generator</a>
                </div>
                <div class="topbar-right">
                    <a href="/login" class="btn-login">Login</a>
                </div>
            </div>
        `;
        document.body.insertBefore(minimalTopbar, document.body.firstChild);
        return minimalTopbar;
    }
}
