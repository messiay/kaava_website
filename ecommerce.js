// Kaava Nutrition E-Commerce Operations

(function () {
    // --- PRODUCT METADATA MAPPING ---
    const PRODUCT_MAP = {
        'athletiblend': { name: 'AthletiBlend', price: 899, img: 'AthletiBlend.jpg' },
        'organic nut butters': { name: 'Organic Nut Butters', price: 499, img: 'nut butter.jpg' },
        'nut butters': { name: 'Organic Nut Butters', price: 499, img: 'nut butter.jpg' },
        'deep recovery formula': { name: 'Deep Recovery Formula', price: 1299, img: 'sleepnig pills.jpg' },
        'muscle repair': { name: 'Deep Recovery Formula', price: 1299, img: 'sleepnig pills.jpg' },
        'daily nourish mix': { name: 'Daily Nourish Mix', price: 799, img: 'Nourish mix.jpg' }
    };

    function resolveProduct(name) {
        const key = name.toLowerCase().trim();
        if (PRODUCT_MAP[key]) return PRODUCT_MAP[key];
        
        // Partial matching
        for (const [k, prod] of Object.entries(PRODUCT_MAP)) {
            if (key.includes(k) || k.includes(key)) {
                return prod;
            }
        }
        // Fallback product
        return { name: name, price: 799, img: 'logo.png' };
    }

    // --- STATE MANAGEMENT ---
    let state = {
        cart: JSON.parse(localStorage.getItem('kaava_cart')) || [],
        token: localStorage.getItem('kaava_token') || null,
        user: null
    };

    // --- INITIALIZE DOM ON LOAD ---
    document.addEventListener('DOMContentLoaded', () => {
        injectHtmlElements();
        setupEventListeners();
        syncAuthState();
        updateCartUI();
        loadGoogleScript();
    });

    // --- FLY-TO-CART & TOAST NOTIFICATION UTILITIES ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `kaava-toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        // Slide-in
        setTimeout(() => toast.classList.add('show'), 50);

        // Dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // --- INJECT HTML OVERLAYS DYNAMICALLY ---
    function injectHtmlElements() {
        // 1. Toast Container
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'kaava-toast-container';
            document.body.appendChild(toastContainer);
        }

        // 2. Overlay Backdrop
        if (!document.getElementById('kaava-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'kaava-overlay';
            overlay.className = 'kaava-overlay';
            document.body.appendChild(overlay);
        }

        // 3. Cart Drawer
        if (!document.getElementById('cart-drawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'cart-drawer';
            drawer.className = 'cart-drawer';
            drawer.innerHTML = `
                <div class="cart-header">
                    <h2>Shopping Cart</h2>
                    <button class="cart-close" id="cart-close-btn">✕</button>
                </div>
                <div class="cart-items-list" id="cart-items-list">
                    <!-- Dynamic Cart Items -->
                </div>
                <div class="cart-footer">
                    <div class="cart-totals">
                        <div class="total-row">
                            <span>Subtotal</span>
                            <span id="cart-subtotal">₹0</span>
                        </div>
                        <div class="total-row">
                            <span>Shipping</span>
                            <span id="cart-shipping">₹0</span>
                        </div>
                        <div class="total-row grand-total">
                            <span>Total</span>
                            <span id="cart-total">₹0</span>
                        </div>
                    </div>
                    <button class="cart-checkout-btn" id="cart-checkout-btn">
                        Proceed To Checkout 🛒
                    </button>
                </div>
            `;
            document.body.appendChild(drawer);
        }

        // 4. Authentication Modal
        if (!document.getElementById('auth-modal')) {
            const authModal = document.createElement('div');
            authModal.id = 'auth-modal';
            authModal.className = 'kaava-modal';
            authModal.innerHTML = `
                <div class="modal-header">
                    <h2>Account Portal</h2>
                    <button class="cart-close" id="auth-close-btn">✕</button>
                </div>
                <div class="auth-tabs">
                    <button class="auth-tab active" id="tab-login-btn">Log In</button>
                    <button class="auth-tab" id="tab-signup-btn">Sign Up</button>
                </div>
                <div class="modal-body">
                    <!-- Login Form -->
                    <form class="auth-form active" id="login-form">
                        <div class="input-group">
                            <label>Email Address</label>
                            <input type="email" id="login-email" placeholder="athlete@example.com" required>
                        </div>
                        <div class="input-group">
                            <label>Password</label>
                            <input type="password" id="login-password" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="cta-btn" style="border:none; width:100%; margin-top:10px;">Log In</button>
                    </form>

                    <!-- Signup Form -->
                    <form class="auth-form" id="signup-form">
                        <div class="input-group">
                            <label>Full Name</label>
                            <input type="text" id="signup-name" placeholder="Your Name" required>
                        </div>
                        <div class="input-group">
                            <label>Email Address</label>
                            <input type="email" id="signup-email" placeholder="athlete@example.com" required>
                        </div>
                        <div class="input-group">
                            <label>Password</label>
                            <input type="password" id="signup-password" placeholder="Min. 6 characters" required minlength="6">
                        </div>
                        <button type="submit" class="cta-btn" style="border:none; width:100%; margin-top:10px;">Create Account</button>
                    </form>

                    <div class="social-login-sep">OR</div>
                    <div id="google-signin-container" style="min-height: 40px; display: flex; justify-content: center; align-items: center; width: 100%;"></div>
                </div>
            `;
            document.body.appendChild(authModal);
        }

        // 5. Checkout Modal
        if (!document.getElementById('checkout-modal')) {
            const checkoutModal = document.createElement('div');
            checkoutModal.id = 'checkout-modal';
            checkoutModal.className = 'kaava-modal';
            checkoutModal.innerHTML = `
                <div class="modal-header">
                    <h2>Checkout Shipping</h2>
                    <button class="cart-close" id="checkout-close-btn">✕</button>
                </div>
                <div class="modal-body">
                    <form id="checkout-form">
                        <div class="checkout-summary-box">
                            <h3 style="color:var(--brand-gold); font-size:1rem; margin-bottom:12px; font-family:var(--font-head);">Order Review</h3>
                            <div class="checkout-items-mini" id="checkout-items-mini">
                                <!-- Checkout items -->
                            </div>
                            <div style="display:flex; justify-content:space-between; font-weight:bold; color:white; font-size:1.1rem; margin-top:5px;">
                                <span>Grand Total:</span>
                                <span id="checkout-grand-total">₹0</span>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Recipient Name</label>
                            <input type="text" id="ship-name" placeholder="Full Name" required>
                        </div>
                        <div class="input-group">
                            <label>Phone Number</label>
                            <input type="tel" id="ship-phone" placeholder="10-digit mobile number" required pattern="[0-9]{10}">
                        </div>
                        <div class="input-group">
                            <label>Delivery Address</label>
                            <input type="text" id="ship-address" placeholder="Street Address, Apartment, Suite" required>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="input-group">
                                <label>City</label>
                                <input type="text" id="ship-city" placeholder="City" required>
                            </div>
                            <div class="input-group">
                                <label>State</label>
                                <input type="text" id="ship-state" placeholder="State" required>
                            </div>
                        </div>
                        <div class="input-group">
                            <label>PIN / ZIP Code</label>
                            <input type="text" id="ship-zip" placeholder="6-digit PIN" required pattern="[0-9]{6}">
                        </div>

                        <div style="color:#81C784; font-size:0.9rem; margin:15px 0; font-weight:bold; text-align:center;">
                            🚛 Scheduled Delivery: 2 Weeks (Cash on Delivery)
                        </div>

                        <button type="submit" class="cta-btn" style="border:none; width:100%;">Place Order</button>
                    </form>
                </div>
            `;
            document.body.appendChild(checkoutModal);
        }

        // 6. Profile & Order History Modal
        if (!document.getElementById('profile-modal')) {
            const profileModal = document.createElement('div');
            profileModal.id = 'profile-modal';
            profileModal.className = 'kaava-modal';
            profileModal.style.maxWidth = '600px';
            profileModal.innerHTML = `
                <div class="modal-header">
                    <h2>Customer Dashboard</h2>
                    <button class="cart-close" id="profile-close-btn">✕</button>
                </div>
                <div class="auth-tabs">
                    <button class="auth-tab active" id="profile-tab-orders">Order History</button>
                    <button class="auth-tab" id="profile-tab-inbox" style="border-left:1px solid var(--card-border);">Admin Email Log</button>
                </div>
                <div class="modal-body">
                    <!-- Profile View -->
                    <div class="profile-details">
                        <div class="profile-name" id="profile-user-name">Welcome Back!</div>
                        <div class="profile-email" id="profile-user-email">athlete@kaavanutrition.in</div>
                        <button class="cta-btn" id="logout-btn" style="border:none; padding: 8px 20px; font-size:0.9rem; width:auto; margin-top:15px; background:rgba(255, 76, 76, 0.1); border:1px solid #ff4c4c; color:#ff4c4c;">Log Out</button>
                    </div>

                    <!-- Orders Section -->
                    <div id="profile-orders-section">
                        <h3 class="order-history-header">Previous Orders</h3>
                        <div class="orders-list" id="profile-orders-list">
                            <!-- Orders dynamic render -->
                        </div>
                    </div>

                    <!-- Developer Simulated Admin Inbox Logs -->
                    <div id="profile-inbox-section" style="display:none;">
                        <h3 class="order-history-header" style="color:#FDD835;">Simulated Admin Email Logs</h3>
                        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:15px; line-height:1.4;">
                            These are the automated order emails written to the console and saved locally during checkout simulation.
                        </p>
                        <div class="orders-list" id="profile-emails-list">
                            <!-- E-mails logs dynamic render -->
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(profileModal);
        }

        // 7. Inject Cart/Account buttons into Header Nav
        injectNavButtons();
    }

    function injectNavButtons() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        // Check if already injected
        if (document.getElementById('nav-cart-link')) return;

        // Create buttons
        const cartButton = document.createElement('button');
        cartButton.id = 'nav-cart-link';
        cartButton.className = 'nav-cart-btn';
        cartButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span class="cart-badge" id="cart-badge-count" style="display:none;">0</span>
        `;
        cartButton.title = 'Open Shopping Cart';

        const profileButton = document.createElement('button');
        profileButton.id = 'nav-profile-link';
        profileButton.className = 'nav-profile-btn';
        profileButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
        profileButton.title = 'Account Dashboard';

        // Insert before mode-toggle button
        const themeBtn = navLinks.querySelector('.theme-toggle');
        if (themeBtn) {
            navLinks.insertBefore(cartButton, themeBtn);
            navLinks.insertBefore(profileButton, themeBtn);
        } else {
            navLinks.appendChild(cartButton);
            navLinks.appendChild(profileButton);
        }
    }

    // --- SETUP EVENT LISTENERS ---
    function setupEventListeners() {
        const overlay = document.getElementById('kaava-overlay');
        const cartDrawer = document.getElementById('cart-drawer');
        const authModal = document.getElementById('auth-modal');
        const checkoutModal = document.getElementById('checkout-modal');
        const profileModal = document.getElementById('profile-modal');

        // Nav click hooks
        const navCart = document.getElementById('nav-cart-link');
        const navProfile = document.getElementById('nav-profile-link');
        if (navCart) navCart.addEventListener('click', toggleCartDrawer);
        if (navProfile) navProfile.addEventListener('click', handleProfileClick);

        // Close button hooks
        document.getElementById('cart-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('auth-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('checkout-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('profile-close-btn').addEventListener('click', closeAllOverlays);
        overlay.addEventListener('click', closeAllOverlays);

        // Checkout Trigger
        document.getElementById('cart-checkout-btn').addEventListener('click', handleCheckoutTrigger);

        // Authentication form tab switches
        const tabLogin = document.getElementById('tab-login-btn');
        const tabSignup = document.getElementById('tab-signup-btn');
        const formLogin = document.getElementById('login-form');
        const formSignup = document.getElementById('signup-form');

        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            formLogin.classList.add('active');
            formSignup.classList.remove('active');
        });

        tabSignup.addEventListener('click', () => {
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            formSignup.classList.add('active');
            formLogin.classList.remove('active');
        });

        // Authentication API Submissions
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            apiAuth('/api/auth/login', { email, password });
        });

        formSignup.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            apiAuth('/api/auth/signup', { name, email, password });
        });

        // Google authentication will be handled via GIS rendering callback or dynamic simulator binding.

        // Logout
        document.getElementById('logout-btn').addEventListener('click', handleLogout);

        // Checkout Order Submission
        document.getElementById('checkout-form').addEventListener('submit', handleOrderSubmit);

        // Profile Tab switches
        const tabOrders = document.getElementById('profile-tab-orders');
        const tabInbox = document.getElementById('profile-tab-inbox');
        const secOrders = document.getElementById('profile-orders-section');
        const secInbox = document.getElementById('profile-inbox-section');

        tabOrders.addEventListener('click', () => {
            tabOrders.classList.add('active');
            tabInbox.classList.remove('active');
            secOrders.style.display = 'block';
            secInbox.style.display = 'none';
        });

        tabInbox.addEventListener('click', () => {
            tabInbox.classList.add('active');
            tabOrders.classList.remove('active');
            secInbox.style.display = 'block';
            secOrders.style.display = 'none';
            fetchSimulatedEmails();
        });
    }

    // --- DRAWER & MODAL TOGGLERS ---
    function toggleCartDrawer() {
        const cartDrawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('kaava-overlay');
        
        closeAllOverlays(); // Close modals first
        
        cartDrawer.classList.toggle('active');
        if (cartDrawer.classList.contains('active')) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    function showModal(modalId) {
        closeAllOverlays();
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('kaava-overlay');
        if (modal) {
            modal.classList.add('active');
            overlay.classList.add('active');
        }
    }

    function closeAllOverlays() {
        document.getElementById('cart-drawer').classList.remove('active');
        document.getElementById('auth-modal').classList.remove('active');
        document.getElementById('checkout-modal').classList.remove('active');
        document.getElementById('profile-modal').classList.remove('active');
        document.getElementById('kaava-overlay').classList.remove('active');
    }

    // --- CART LOGIC ---
    window.orderProduct = function (productName) {
        // Intercept global call
        if (typeof window.closeCard === 'function') window.closeCard();
        
        const item = resolveProduct(productName);
        addToCart(item.name, item.price, item.img);
    };

    function addToCart(name, price, img) {
        const existing = state.cart.find(i => i.name === name);
        if (existing) {
            existing.quantity += 1;
        } else {
            state.cart.push({ name, price, img, quantity: 1 });
        }
        
        localStorage.setItem('kaava_cart', JSON.stringify(state.cart));
        updateCartUI();
        showToast(`${name} added to cart!`, 'success');
        
        // Open drawer automatically for micro-interaction satisfaction
        setTimeout(toggleCartDrawer, 300);
    }

    function updateQty(name, delta) {
        const item = state.cart.find(i => i.name === name);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                state.cart = state.cart.filter(i => i.name !== name);
            }
            localStorage.setItem('kaava_cart', JSON.stringify(state.cart));
            updateCartUI();
        }
    }

    function removeItem(name) {
        state.cart = state.cart.filter(i => i.name !== name);
        localStorage.setItem('kaava_cart', JSON.stringify(state.cart));
        updateCartUI();
        showToast('Item removed', 'info');
    }

    function updateCartUI() {
        const list = document.getElementById('cart-items-list');
        const badge = document.getElementById('cart-badge-count');
        const subtotalText = document.getElementById('cart-subtotal');
        const shippingText = document.getElementById('cart-shipping');
        const totalText = document.getElementById('cart-total');

        if (state.cart.length === 0) {
            list.innerHTML = `
                <div class="cart-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <p>Your performance cart is empty.</p>
                </div>
            `;
            badge.style.display = 'none';
            subtotalText.innerText = '₹0';
            shippingText.innerText = '₹0';
            totalText.innerText = '₹0';
            return;
        }

        // Render items
        list.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <img class="cart-item-img" src="${item.img}" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">₹${item.price}</div>
                    <div class="cart-item-actions">
                        <button class="qty-btn dec-btn" data-name="${item.name}">-</button>
                        <span class="cart-item-qty">${item.quantity}</span>
                        <button class="qty-btn inc-btn" data-name="${item.name}">+</button>
                    </div>
                </div>
                <button class="cart-item-remove remove-btn" data-name="${item.name}">Remove</button>
            </div>
        `).join('');

        // Wire actions
        list.querySelectorAll('.dec-btn').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.name, -1)));
        list.querySelectorAll('.inc-btn').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.name, 1)));
        list.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', () => removeItem(b.dataset.name)));

        // Totals
        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal > 999 ? 0 : 99; // Free shipping over 999
        const total = subtotal + shipping;
        const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

        badge.innerText = count;
        badge.style.display = 'flex';

        subtotalText.innerText = `₹${subtotal}`;
        shippingText.innerText = shipping === 0 ? 'FREE' : `₹${shipping}`;
        totalText.innerText = `₹${total}`;
    }

    // --- CHECKOUT FLOWS ---
    function handleCheckoutTrigger() {
        if (state.cart.length === 0) {
            showToast('Add some items first!', 'error');
            return;
        }

        if (!state.token) {
            showToast('Please login to place your order.', 'info');
            showModal('auth-modal');
            return;
        }

        // Setup checkout modal summaries
        const miniContainer = document.getElementById('checkout-items-mini');
        miniContainer.innerHTML = state.cart.map(item => `
            <div class="mini-item">
                <span class="mini-item-name">${item.name} x ${item.quantity}</span>
                <span class="mini-item-qty-price">₹${item.price * item.quantity}</span>
            </div>
        `).join('');

        const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal > 999 ? 0 : 99;
        const grandTotal = subtotal + shipping;

        document.getElementById('checkout-grand-total').innerText = `₹${grandTotal}`;

        // Auto-fill checkout fields if user exists
        if (state.user) {
            document.getElementById('ship-name').value = state.user.name || '';
        }

        showModal('checkout-modal');
    }

    function handleOrderSubmit(e) {
        e.preventDefault();
        
        const shippingDetails = {
            name: document.getElementById('ship-name').value,
            phone: document.getElementById('ship-phone').value,
            address: document.getElementById('ship-address').value,
            city: document.getElementById('ship-city').value,
            state: document.getElementById('ship-state').value,
            zip: document.getElementById('ship-zip').value
        };

        const payload = {
            items: state.cart,
            shippingDetails
        };

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText = submitBtn.innerText;
        submitBtn.innerText = 'Scheduling Order...';
        submitBtn.disabled = true;

        fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                submitBtn.innerText = origText;
                submitBtn.disabled = false;
                return;
            }

            // Success Order placed
            showToast('Order scheduled successfully!', 'success');
            
            // Success Modal Dialog
            closeAllOverlays();
            
            // Render receipt confirmation modal in place of checkout
            state.cart = [];
            localStorage.setItem('kaava_cart', JSON.stringify([]));
            updateCartUI();

            // Notify user of 2-week delivery
            alert(`🎉 Order ${data.orderId} Placed!\n\nYour order has been recorded and will arrive in exactly 2 weeks.\n\nAn email alert has been simulated/sent to the administrator.`);
        })
        .catch(err => {
            console.error(err);
            showToast('Order failed. Try again.', 'error');
            submitBtn.innerText = origText;
            submitBtn.disabled = false;
        });
    }

    // --- AUTHENTICATION API FLOWS ---
    function apiAuth(url, body, successMsg = 'Welcome to Kaava!') {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('kaava_token', data.token);
            
            showToast(successMsg, 'success');
            syncAuthState();
            closeAllOverlays();

            // If we came from click-checkout, resume
            if (document.getElementById('checkout-modal').dataset.pendingTrigger === 'true') {
                delete document.getElementById('checkout-modal').dataset.pendingTrigger;
                handleCheckoutTrigger();
            }
        })
        .catch(err => {
            console.error(err);
            showToast('Authentication failed.', 'error');
        });
    }

    function handleLogout() {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        })
        .finally(() => {
            state.token = null;
            state.user = null;
            localStorage.removeItem('kaava_token');
            syncAuthState();
            closeAllOverlays();
            showToast('Logged out.', 'info');
        });
    }

    function syncAuthState() {
        if (!state.token) {
            state.user = null;
            return;
        }

        // Fetch profile
        fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        })
        .then(res => {
            if (res.status === 401) {
                // Token expired/invalid
                state.token = null;
                localStorage.removeItem('kaava_token');
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data && data.success) {
                state.user = data.user;
                
                // Update profile dashboard values
                document.getElementById('profile-user-name').innerText = `Athlete: ${state.user.name}`;
                document.getElementById('profile-user-email').innerText = state.user.email;
            }
        })
        .catch(err => console.error('Auth state validation failed:', err));
    }

    function handleProfileClick() {
        if (!state.token) {
            // Mark checkout modal as triggered after auth if they were trying to checkout
            showModal('auth-modal');
        } else {
            // Render Order History and show dashboard
            fetchOrderHistory();
            showModal('profile-modal');
        }
    }

    // --- FETCH ORDER HISTORY ---
    function fetchOrderHistory() {
        const list = document.getElementById('profile-orders-list');
        list.innerHTML = '<div style="text-align:center; padding:30px;">Loading order history...</div>';

        fetch('/api/orders', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                list.innerHTML = `<div style="color:#ff4c4c; text-align:center; padding:30px;">${data.error}</div>`;
                return;
            }

            if (!data.orders || data.orders.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; color:var(--text-muted); padding:40px 0;">
                        <p>No orders placed yet.</p>
                        <button class="cta-btn" onclick="document.getElementById('profile-modal').classList.remove('active'); document.getElementById('kaava-overlay').classList.remove('active');" style="border:none; padding:10px 20px; font-size:0.9rem; margin-top:15px; width:auto;">Shop Now</button>
                    </div>
                `;
                return;
            }

            // Render order cards
            list.innerHTML = data.orders.map(order => {
                const orderDate = new Date(order.createdAt).toLocaleDateString();
                const estDelivery = new Date(order.estimatedDeliveryDate).toLocaleDateString();
                
                // Track timeline state values
                // 50% for Shipped status, standard timeline
                return `
                    <div class="order-card">
                        <div class="order-card-header">
                            <span class="order-id">${order.id}</span>
                            <span class="order-date">${orderDate}</span>
                        </div>
                        <div class="order-items-summary">
                            ${order.items.map(i => `<div style="margin-bottom:5px;">• ${i.name} (${i.quantity}x) - ₹${i.price * i.quantity}</div>`).join('')}
                        </div>
                        
                        <!-- Timeline tracking progress -->
                        <div class="delivery-tracker">
                            <div class="tracker-timeline">
                                <div class="tracker-timeline-progress"></div>
                                <div class="tracker-node active">1</div>
                                <div class="tracker-node active">2</div>
                                <div class="tracker-node">3</div>
                            </div>
                            <div class="tracker-labels">
                                <div class="tracker-label active">Ordered</div>
                                <div class="tracker-label active">Shipped</div>
                                <div class="tracker-label">Arrived</div>
                            </div>
                        </div>

                        <div class="delivery-estimate-banner">
                            🚛 Estimated Delivery: ${estDelivery} (in 2 weeks)
                        </div>

                        <div class="order-card-footer">
                            <div class="order-total">Paid: ₹${order.total}</div>
                            <span class="order-status-badge">${order.status}</span>
                        </div>
                    </div>
                `;
            }).join('');
        })
        .catch(err => {
            console.error(err);
            list.innerHTML = '<div style="color:#ff4c4c; text-align:center; padding:30px;">Failed to load order history.</div>';
        });
    }

    // --- FETCH SIMULATED DEVELOEPR EMAILS ---
    function fetchSimulatedEmails() {
        const list = document.getElementById('profile-emails-list');
        list.innerHTML = '<div style="text-align:center; padding:30px;">Fetching simulated logs...</div>';

        fetch('/api/admin/emails', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                list.innerHTML = `<div style="color:#ff4c4c; text-align:center; padding:30px;">${data.error}</div>`;
                return;
            }

            if (!data.emails || data.emails.length === 0) {
                list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px;">No simulated emails generated yet. Complete a checkout to trigger order emails.</div>';
                return;
            }

            list.innerHTML = data.emails.map(email => {
                const sentTime = new Date(email.sentAt).toLocaleTimeString();
                const sentDate = new Date(email.sentAt).toLocaleDateString();
                return `
                    <div class="email-log-card">
                        <div class="email-log-header">
                            <span>To: ${email.to}</span>
                            <span>${sentDate} ${sentTime}</span>
                        </div>
                        <div class="email-log-subject">${email.subject}</div>
                        <button class="email-view-btn" data-id="${email.id}">Toggle Content HTML</button>
                        <div class="email-sandbox-frame" id="sandbox-${email.id}" style="display:none; margin-top:10px;">
                            ${email.html}
                        </div>
                    </div>
                `;
            }).join('');

            // Add toggle event listeners
            list.querySelectorAll('.email-view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const box = document.getElementById(`sandbox-${btn.dataset.id}`);
                    if (box) {
                        box.style.display = box.style.display === 'none' ? 'block' : 'none';
                    }
                });
            });
        })
        .catch(err => {
            console.error(err);
            list.innerHTML = '<div style="color:#ff4c4c; text-align:center; padding:30px;">Failed to load simulated logs.</div>';
        });
    }

    let googleClientId = '';

    function loadGoogleScript() {
        fetch('/api/config')
            .then(res => res.json())
            .then(config => {
                googleClientId = config.googleClientId;
                
                // Inject the Google client script
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = initializeGoogleSignIn;
                document.head.appendChild(script);
            })
            .catch(err => {
                console.error('Failed to load Google Client Config:', err);
                initializeGoogleSignIn();
            });
    }

    function initializeGoogleSignIn() {
        const container = document.getElementById('google-signin-container');
        if (!container) return;

        if (googleClientId && window.google && window.google.accounts) {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleCredentialResponse
                });

                window.google.accounts.id.renderButton(
                    container,
                    { 
                        theme: 'outline', 
                        size: 'large', 
                        width: 320,
                        text: 'signin_with'
                    }
                );

                window.google.accounts.id.prompt(); // One Tap support
                console.log('✅ Real Google Identity Sign-in initialized.');
            } catch (err) {
                console.error('Failed to initialize official Google Sign-in, falling back to simulated:', err);
                setupSimulatedGoogleButton(container);
            }
        } else {
            setupSimulatedGoogleButton(container);
        }
    }

    function setupSimulatedGoogleButton(container) {
        container.innerHTML = '';

        const fallbackBtn = document.createElement('button');
        fallbackBtn.className = 'google-login-btn';
        fallbackBtn.innerHTML = `
            <svg class="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google (Simulation)
        `;

        fallbackBtn.addEventListener('click', () => {
            showToast('Simulating Google Login...', 'info');
            setTimeout(() => {
                const email = prompt("Enter a simulated Google Email to authenticate:", "athlete@kaavanutrition.in");
                if (!email) return;

                const name = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
                const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

                apiAuth('/api/auth/google-login', { 
                    name: formattedName || 'Elite Athlete', 
                    email: email 
                }, `Logged in as ${email}!`);
            }, 500);
        });

        container.appendChild(fallbackBtn);
    }

    function handleCredentialResponse(response) {
        apiAuth('/api/auth/google-login', { 
            credential: response.credential 
        }, 'Google account verified securely!');
    }
})();
