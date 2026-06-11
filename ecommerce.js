// Kaava Nutrition E-Commerce — Customer Shopping Experience

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
        for (const [k, prod] of Object.entries(PRODUCT_MAP)) {
            if (key.includes(k) || k.includes(key)) return prod;
        }
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
        loadGoogleSignIn(); // Load real Google Identity Services
    });

    // --- TOAST NOTIFICATIONS ---
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
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // --- INJECT ALL HTML OVERLAYS ---
    function injectHtmlElements() {
        // 1. Toast Container
        if (!document.getElementById('toast-container')) {
            const tc = document.createElement('div');
            tc.id = 'toast-container';
            tc.className = 'kaava-toast-container';
            document.body.appendChild(tc);
        }

        // 2. Overlay Backdrop
        if (!document.getElementById('kaava-overlay')) {
            const ov = document.createElement('div');
            ov.id = 'kaava-overlay';
            ov.className = 'kaava-overlay';
            document.body.appendChild(ov);
        }

        // 3. Cart Drawer
        if (!document.getElementById('cart-drawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'cart-drawer';
            drawer.className = 'cart-drawer';
            drawer.innerHTML = `
                <div class="cart-header">
                    <h2>🛒 Your Cart</h2>
                    <button class="cart-close" id="cart-close-btn">✕</button>
                </div>
                <div class="cart-items-list" id="cart-items-list"></div>
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
                        <div class="total-row">
                            <span style="color:var(--text-muted); font-size:0.8rem;">Free shipping on orders above ₹999</span>
                            <span></span>
                        </div>
                        <div class="total-row grand-total">
                            <span>Total</span>
                            <span id="cart-total">₹0</span>
                        </div>
                    </div>
                    <button class="cart-checkout-btn" id="cart-checkout-btn">
                        Proceed to Checkout →
                    </button>
                </div>
            `;
            document.body.appendChild(drawer);
        }

        // 4. Auth Modal — Google Sign-In Only
        if (!document.getElementById('auth-modal')) {
            const authModal = document.createElement('div');
            authModal.id = 'auth-modal';
            authModal.className = 'kaava-modal';
            authModal.style.maxWidth = '420px';
            authModal.innerHTML = `
                <div class="modal-header" style="border-bottom:none; padding-bottom:0;">
                    <div></div>
                    <button class="cart-close" id="auth-close-btn">✕</button>
                </div>
                <div class="modal-body" style="padding-top:10px; text-align:center;">
                    <div class="google-auth-logo">
                        <svg width="40" height="40" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                    </div>
                    <h2 style="font-size:1.6rem; margin-bottom:6px;">Sign in to Kaava</h2>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:28px; line-height:1.5;">
                        Use your Google account to shop, track orders, and get delivery updates.
                    </p>
                    <div id="google-signin-btn-container" style="display:flex; justify-content:center; min-height:44px; margin-bottom:20px;"></div>
                    <p style="color:var(--text-muted); font-size:0.75rem; line-height:1.5; padding: 0 10px;">
                        By signing in, you agree to Kaava Nutrition's terms. Your Google profile (name &amp; email) will be used to manage your orders.
                    </p>
                </div>
            `;
            document.body.appendChild(authModal);
        }


        // 5. Checkout Modal — Multi-step Amazon style
        if (!document.getElementById('checkout-modal')) {
            const checkoutModal = document.createElement('div');
            checkoutModal.id = 'checkout-modal';
            checkoutModal.className = 'kaava-modal';
            checkoutModal.style.maxWidth = '560px';
            checkoutModal.innerHTML = `
                <div class="modal-header">
                    <div>
                        <h2 id="checkout-modal-title">Delivery Details</h2>
                        <div class="checkout-steps-bar" id="checkout-steps-bar">
                            <div class="checkout-step-indicator active" id="step-ind-1">
                                <div class="step-circle">1</div>
                                <span>Shipping</span>
                            </div>
                            <div class="checkout-step-divider"></div>
                            <div class="checkout-step-indicator" id="step-ind-2">
                                <div class="step-circle">2</div>
                                <span>Review</span>
                            </div>
                            <div class="checkout-step-divider"></div>
                            <div class="checkout-step-indicator" id="step-ind-3">
                                <div class="step-circle">✓</div>
                                <span>Confirmed</span>
                            </div>
                        </div>
                    </div>
                    <button class="cart-close" id="checkout-close-btn">✕</button>
                </div>
                <div class="modal-body" id="checkout-modal-body">

                    <!-- STEP 1: Shipping Details -->
                    <div class="checkout-step active" id="checkout-step-1">
                        <form id="checkout-form">
                            <div class="shipping-user-info" id="shipping-user-info" style="display:none;">
                                <div class="shipping-user-chip">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Ordering as <strong id="shipping-as-email"></strong>
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Recipient Full Name</label>
                                <input type="text" id="ship-name" placeholder="Name on delivery" required>
                            </div>
                            <div class="input-group">
                                <label>Mobile Number</label>
                                <input type="tel" id="ship-phone" placeholder="10-digit number" required pattern="[0-9]{10}" maxlength="10">
                            </div>
                            <div class="input-group">
                                <label>Street Address</label>
                                <input type="text" id="ship-address" placeholder="House / Flat / Block No., Street Name" required>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
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
                                <label>PIN Code</label>
                                <input type="text" id="ship-zip" placeholder="6-digit PIN" required pattern="[0-9]{6}" maxlength="6">
                            </div>
                            <button type="submit" class="cta-btn" style="border:none; width:100%; margin-top:5px;" id="shipping-next-btn">
                                Continue to Review →
                            </button>
                        </form>
                    </div>

                    <!-- STEP 2: Order Review -->
                    <div class="checkout-step" id="checkout-step-2">
                        <div class="review-section">
                            <div class="review-block">
                                <div class="review-block-title">
                                    <span>📦 Items</span>
                                </div>
                                <div id="review-items-list"></div>
                            </div>
                            <div class="review-block">
                                <div class="review-block-title">
                                    <span>📍 Delivering To</span>
                                    <button class="review-edit-btn" id="review-edit-address">Edit</button>
                                </div>
                                <div id="review-address-text" style="color:var(--text-main); font-size:0.95rem; line-height:1.6;"></div>
                            </div>
                            <div class="review-block">
                                <div class="review-block-title"><span>💳 Payment</span></div>
                                <div style="color:var(--text-main); font-size:0.95rem;">
                                    Cash on Delivery (COD)
                                </div>
                            </div>
                            <div class="review-totals" id="review-totals"></div>
                            <div class="delivery-timing-box">
                                <span>🚛</span>
                                <div>
                                    <div style="font-weight:bold; color:#81C784;">Estimated Delivery: 2 Weeks</div>
                                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;" id="review-delivery-date">Arrives by —</div>
                                </div>
                            </div>
                            <button class="cta-btn" id="place-order-btn" style="border:none; width:100%; margin-top:10px;">
                                Place Order ✓
                            </button>
                            <p style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:12px;">
                                By placing your order you agree to our terms. A confirmation email will be sent to your inbox.
                            </p>
                        </div>
                    </div>

                    <!-- STEP 3: Order Confirmation Success -->
                    <div class="checkout-step" id="checkout-step-3">
                        <div class="order-success-screen">
                            <div class="success-checkmark">
                                <svg viewBox="0 0 52 52" fill="none">
                                    <circle cx="26" cy="26" r="25" stroke="#33ff8c" stroke-width="2"/>
                                    <path class="success-check-path" d="M14 27l8 8 16-16" stroke="#33ff8c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <h2 class="success-title">Order Placed!</h2>
                            <p class="success-subtitle">Thank you for shopping with Kaava Nutrition.</p>
                            <div class="success-order-id" id="success-order-id"></div>
                            <div class="success-email-notice" id="success-email-notice">
                                A confirmation email has been sent to your inbox.
                            </div>
                            <div class="success-details-box" id="success-details-box"></div>
                            <div class="success-delivery-box">
                                <span>📅</span>
                                <div>
                                    <div style="font-weight:bold;">Expected Delivery</div>
                                    <div id="success-delivery-date" style="color:#81C784; font-size:1rem; margin-top:3px;"></div>
                                </div>
                            </div>
                            <button class="cta-btn" id="success-view-orders-btn" style="border:none; width:100%; margin-top:20px; background:rgba(253,216,53,0.1); border:1px solid var(--brand-gold); color:var(--brand-gold);">
                                View My Orders
                            </button>
                            <button class="cart-checkout-btn" id="success-continue-btn" style="margin-top:10px; border:1px solid rgba(255,255,255,0.1); color:var(--text-muted);">
                                Continue Shopping
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(checkoutModal);
        }

        // 6. Profile & Order History Modal (customer-only, no admin tabs)
        if (!document.getElementById('profile-modal')) {
            const profileModal = document.createElement('div');
            profileModal.id = 'profile-modal';
            profileModal.className = 'kaava-modal';
            profileModal.style.maxWidth = '600px';
            profileModal.innerHTML = `
                <div class="modal-header">
                    <h2>My Account</h2>
                    <button class="cart-close" id="profile-close-btn">✕</button>
                </div>
                <div class="modal-body">
                    <!-- Profile Card -->
                    <div class="profile-details">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div class="profile-avatar" id="profile-avatar-circle">A</div>
                            <div>
                                <div class="profile-name" id="profile-user-name">Welcome!</div>
                                <div class="profile-email" id="profile-user-email"></div>
                            </div>
                        </div>
                        <button class="logout-btn" id="logout-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Sign Out
                        </button>
                    </div>

                    <!-- Order History -->
                    <div id="profile-orders-section">
                        <h3 class="order-history-header">My Orders</h3>
                        <div class="orders-list" id="profile-orders-list"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(profileModal);
        }

        // 7. Inject Nav Buttons
        injectNavButtons();
    }

    function injectNavButtons() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks || document.getElementById('nav-cart-link')) return;

        const cartButton = document.createElement('button');
        cartButton.id = 'nav-cart-link';
        cartButton.className = 'nav-cart-btn';
        cartButton.title = 'Shopping Cart';
        cartButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span class="cart-badge" id="cart-badge-count" style="display:none;">0</span>
        `;

        const profileButton = document.createElement('button');
        profileButton.id = 'nav-profile-link';
        profileButton.className = 'nav-profile-btn';
        profileButton.title = 'My Account';
        profileButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;

        const themeBtn = navLinks.querySelector('.theme-toggle');
        if (themeBtn) {
            navLinks.insertBefore(cartButton, themeBtn);
            navLinks.insertBefore(profileButton, themeBtn);
        } else {
            navLinks.appendChild(cartButton);
            navLinks.appendChild(profileButton);
        }
    }

    // --- SETUP ALL EVENT LISTENERS ---
    function setupEventListeners() {
        const overlay = document.getElementById('kaava-overlay');

        // Nav buttons
        document.getElementById('nav-cart-link').addEventListener('click', toggleCartDrawer);
        document.getElementById('nav-profile-link').addEventListener('click', handleProfileClick);

        // Close buttons
        document.getElementById('cart-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('auth-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('checkout-close-btn').addEventListener('click', closeAllOverlays);
        document.getElementById('profile-close-btn').addEventListener('click', closeAllOverlays);
        overlay.addEventListener('click', closeAllOverlays);

        // Cart checkout trigger
        document.getElementById('cart-checkout-btn').addEventListener('click', handleCheckoutTrigger);

        // Logout
        document.getElementById('logout-btn').addEventListener('click', handleLogout);

        // Checkout Step 1 form submit (moves to review)
        document.getElementById('checkout-form').addEventListener('submit', (e) => {
            e.preventDefault();
            goToCheckoutStep2();
        });

        // Step 2: Edit address button
        document.getElementById('review-edit-address').addEventListener('click', () => goToCheckoutStep(1));

        // Step 2: Place order
        document.getElementById('place-order-btn').addEventListener('click', handleOrderSubmit);

        // Success screen buttons
        document.getElementById('success-view-orders-btn').addEventListener('click', () => {
            closeAllOverlays();
            fetchOrderHistory();
            showModal('profile-modal');
        });
        document.getElementById('success-continue-btn').addEventListener('click', closeAllOverlays);
    }

    // --- MODAL / DRAWER CONTROLS ---
    function toggleCartDrawer() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('kaava-overlay');
        closeAllOverlays();
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }

    function showModal(modalId) {
        closeAllOverlays();
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('kaava-overlay');
        if (modal) { modal.classList.add('active'); overlay.classList.add('active'); }
    }

    function closeAllOverlays() {
        ['cart-drawer', 'auth-modal', 'checkout-modal', 'profile-modal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        document.getElementById('kaava-overlay').classList.remove('active');
    }

    // --- CART LOGIC ---
    window.orderProduct = function (productName) {
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
        setTimeout(toggleCartDrawer, 300);
    }

    function updateQty(name, delta) {
        const item = state.cart.find(i => i.name === name);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) state.cart = state.cart.filter(i => i.name !== name);
        localStorage.setItem('kaava_cart', JSON.stringify(state.cart));
        updateCartUI();
    }

    function removeItem(name) {
        state.cart = state.cart.filter(i => i.name !== name);
        localStorage.setItem('kaava_cart', JSON.stringify(state.cart));
        updateCartUI();
        showToast('Item removed from cart', 'info');
    }

    function updateCartUI() {
        const list = document.getElementById('cart-items-list');
        const badge = document.getElementById('cart-badge-count');
        const subtotalEl = document.getElementById('cart-subtotal');
        const shippingEl = document.getElementById('cart-shipping');
        const totalEl = document.getElementById('cart-total');
        if (!list) return;

        if (state.cart.length === 0) {
            list.innerHTML = `
                <div class="cart-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <p>Your cart is empty</p>
                    <a href="products.html" style="color:var(--brand-gold); text-decoration:none; font-weight:bold; font-size:0.9rem; border:1px solid var(--brand-gold); padding:8px 18px; border-radius:4px; display:inline-block; margin-top:10px; transition:0.3s;" onmouseover="this.style.background='var(--brand-gold)';this.style.color='#000';" onmouseout="this.style.background='transparent';this.style.color='var(--brand-gold)';">Shop Products →</a>
                </div>
            `;
            if (badge) badge.style.display = 'none';
            if (subtotalEl) subtotalEl.innerText = '₹0';
            if (shippingEl) shippingEl.innerText = '₹0';
            if (totalEl) totalEl.innerText = '₹0';
            return;
        }

        list.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <img class="cart-item-img" src="${item.img}" alt="${item.name}" onerror="this.src='logo.png'">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">₹${item.price.toLocaleString('en-IN')} each</div>
                    <div class="cart-item-actions">
                        <button class="qty-btn dec-btn" data-name="${item.name}">−</button>
                        <span class="cart-item-qty">${item.quantity}</span>
                        <button class="qty-btn inc-btn" data-name="${item.name}">+</button>
                        <span style="color:var(--brand-gold); font-weight:bold; margin-left:5px;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <button class="cart-item-remove remove-btn" data-name="${item.name}" title="Remove item">✕</button>
            </div>
        `).join('');

        list.querySelectorAll('.dec-btn').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.name, -1)));
        list.querySelectorAll('.inc-btn').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.name, 1)));
        list.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', () => removeItem(b.dataset.name)));

        const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        const shipping = subtotal > 999 ? 0 : 99;
        const total = subtotal + shipping;
        const count = state.cart.reduce((s, i) => s + i.quantity, 0);

        if (badge) { badge.innerText = count; badge.style.display = 'flex'; }
        if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        if (shippingEl) shippingEl.innerText = shipping === 0 ? 'FREE ✓' : `₹${shipping}`;
        if (totalEl) totalEl.innerText = `₹${total.toLocaleString('en-IN')}`;
    }

    // --- CHECKOUT FLOW ---
    let pendingShipping = null;

    function handleCheckoutTrigger() {
        if (state.cart.length === 0) {
            showToast('Add some items to your cart first!', 'error');
            return;
        }
        if (!state.token) {
            showToast('Please sign in to place your order.', 'info');
            showModal('auth-modal');
            document.getElementById('checkout-modal').dataset.pendingCheckout = 'true';
            return;
        }
        openCheckoutStep1();
    }

    function openCheckoutStep1() {
        // Pre-fill user name
        if (state.user) {
            const nameField = document.getElementById('ship-name');
            if (nameField && !nameField.value) nameField.value = state.user.name || '';

            // Show "Ordering as" chip
            const chip = document.getElementById('shipping-user-info');
            const chipEmail = document.getElementById('shipping-as-email');
            if (chip && chipEmail) {
                chipEmail.textContent = state.user.email;
                chip.style.display = 'block';
            }

            // Pre-fill last address if available
            if (state.user.lastAddress) {
                const addr = state.user.lastAddress;
                const fill = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val || ''; };
                fill('ship-name', addr.name);
                fill('ship-phone', addr.phone);
                fill('ship-address', addr.address);
                fill('ship-city', addr.city);
                fill('ship-state', addr.state);
                fill('ship-zip', addr.zip);
            }
        }
        goToCheckoutStep(1);
        showModal('checkout-modal');
    }

    function goToCheckoutStep(step) {
        [1, 2, 3].forEach(n => {
            document.getElementById(`checkout-step-${n}`).classList.toggle('active', n === step);
            const ind = document.getElementById(`step-ind-${n}`);
            if (ind) {
                ind.classList.toggle('active', n <= step);
                ind.classList.toggle('completed', n < step);
            }
        });
        const titles = { 1: 'Delivery Details', 2: 'Review Your Order', 3: 'Order Confirmed' };
        document.getElementById('checkout-modal-title').innerText = titles[step] || '';
    }

    function goToCheckoutStep2() {
        const ship = {
            name: document.getElementById('ship-name').value.trim(),
            phone: document.getElementById('ship-phone').value.trim(),
            address: document.getElementById('ship-address').value.trim(),
            city: document.getElementById('ship-city').value.trim(),
            state: document.getElementById('ship-state').value.trim(),
            zip: document.getElementById('ship-zip').value.trim()
        };
        pendingShipping = ship;

        const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        const shipping = subtotal > 999 ? 0 : 99;
        const total = subtotal + shipping;

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 14);
        const deliveryStr = deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Render items review
        document.getElementById('review-items-list').innerHTML = state.cart.map(item => `
            <div class="review-item-row">
                <img src="${item.img}" alt="${item.name}" onerror="this.src='logo.png'">
                <div class="review-item-info">
                    <div class="review-item-name">${item.name}</div>
                    <div class="review-item-meta">Qty: ${item.quantity} &nbsp;·&nbsp; ₹${item.price.toLocaleString('en-IN')} each</div>
                </div>
                <div class="review-item-total">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
            </div>
        `).join('');

        // Render address
        document.getElementById('review-address-text').innerHTML = `
            <strong>${ship.name}</strong> &nbsp; ${ship.phone}<br>
            ${ship.address}<br>
            ${ship.city}, ${ship.state} — ${ship.zip}
        `;

        // Render totals
        document.getElementById('review-totals').innerHTML = `
            <div class="review-total-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
            <div class="review-total-row"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:#81C784">FREE</span>' : '₹' + shipping}</span></div>
            <div class="review-total-row grand"><span>Grand Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>
        `;

        document.getElementById('review-delivery-date').innerText = `Estimated arrival: ${deliveryStr}`;

        goToCheckoutStep(2);
    }

    function handleOrderSubmit() {
        const btn = document.getElementById('place-order-btn');
        btn.innerText = 'Placing Order...';
        btn.disabled = true;

        const payload = { items: state.cart, shippingDetails: pendingShipping };

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
            btn.innerText = 'Place Order ✓';
            btn.disabled = false;

            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            // Clear cart
            state.cart = [];
            localStorage.setItem('kaava_cart', JSON.stringify([]));
            updateCartUI();

            // Show success screen
            const delivDate = new Date(data.order.estimatedDeliveryDate);
            const delivStr = delivDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            document.getElementById('success-order-id').innerHTML = `
                Order ID: <span style="color:var(--brand-gold); font-family: monospace;">${data.orderId}</span>
            `;
            document.getElementById('success-email-notice').innerHTML = `
                📧 Confirmation email sent to <strong>${state.user ? state.user.email : 'your inbox'}</strong>
            `;
            document.getElementById('success-details-box').innerHTML = data.order.items.map(i =>
                `<div class="success-item-row"><span>${i.name} × ${i.quantity}</span><span>₹${(i.price * i.quantity).toLocaleString('en-IN')}</span></div>`
            ).join('') + `<div class="success-item-row grand"><span>Total Paid</span><span>₹${data.order.total.toLocaleString('en-IN')}</span></div>`;
            document.getElementById('success-delivery-date').innerText = delivStr;

            goToCheckoutStep(3);
        })
        .catch(err => {
            console.error(err);
            btn.innerText = 'Place Order ✓';
            btn.disabled = false;
            showToast('Something went wrong. Please try again.', 'error');
        });
    }

    // --- GOOGLE SIGN-IN (Real GIS) ---
    function loadGoogleSignIn() {
        // Fetch the Client ID from backend config
        fetch('/api/config')
            .then(r => r.json())
            .then(cfg => {
                const clientId = cfg.googleClientId;
                if (!clientId) {
                    // No Client ID set — show a setup notice inside the button container
                    const container = document.getElementById('google-signin-btn-container');
                    if (container) {
                        container.innerHTML = `
                            <div style="background:rgba(255,76,76,0.08); border:1px solid rgba(255,76,76,0.2); border-radius:8px; padding:14px 18px; font-size:0.82rem; color:#ff8080; text-align:left; line-height:1.6;">
                                <strong>Google Sign-In not configured.</strong><br>
                                Set <code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:3px;">GOOGLE_CLIENT_ID</code> in the server environment to enable Google login.
                            </div>`;
                    }
                    return;
                }

                // Load Google Identity Services script
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => initGoogleButton(clientId);
                document.head.appendChild(script);
            })
            .catch(err => console.error('Failed to load Google config:', err));
    }

    function initGoogleButton(clientId) {
        if (typeof google === 'undefined' || !google.accounts) return;

        // Expose callback globally so GIS can call it
        window.handleGoogleCredential = function(response) {
            const container = document.getElementById('google-signin-btn-container');
            if (container) container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">Signing you in...</div>';

            fetch('/api/auth/google-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error, 'error');
                    // Re-render button
                    initGoogleButton(clientId);
                    return;
                }
                state.token = data.token;
                state.user = data.user;
                localStorage.setItem('kaava_token', data.token);
                showToast(`Welcome, ${data.user.name}! 👋`, 'success');
                syncAuthState();
                closeAllOverlays();

                // Resume pending checkout if any
                const checkoutModal = document.getElementById('checkout-modal');
                if (checkoutModal && checkoutModal.dataset.pendingCheckout === 'true') {
                    delete checkoutModal.dataset.pendingCheckout;
                    setTimeout(openCheckoutStep1, 400);
                    setTimeout(() => showModal('checkout-modal'), 450);
                }
            })
            .catch(() => {
                showToast('Sign-in failed. Please try again.', 'error');
                initGoogleButton(clientId);
            });
        };

        google.accounts.id.initialize({
            client_id: clientId,
            callback: window.handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: false
        });

        const container = document.getElementById('google-signin-btn-container');
        if (container) {
            google.accounts.id.renderButton(container, {
                type: 'standard',
                shape: 'rectangular',
                theme: 'outline',
                text: 'signin_with',
                size: 'large',
                logo_alignment: 'left',
                width: 320
            });
        }
    }

    function handleLogout() {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        }).finally(() => {
            state.token = null;
            state.user = null;
            localStorage.removeItem('kaava_token');
            syncAuthState();
            closeAllOverlays();
            showToast('Signed out successfully.', 'info');
        });
    }

    function syncAuthState() {
        if (!state.token) { state.user = null; return; }

        fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${state.token}` } })
        .then(res => {
            if (res.status === 401) {
                state.token = null;
                localStorage.removeItem('kaava_token');
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data && data.success) {
                state.user = data.user;
                const nameEl = document.getElementById('profile-user-name');
                const emailEl = document.getElementById('profile-user-email');
                const avatarEl = document.getElementById('profile-avatar-circle');
                if (nameEl) nameEl.innerText = state.user.name;
                if (emailEl) emailEl.innerText = state.user.email;
                if (avatarEl) avatarEl.innerText = (state.user.name || 'U').charAt(0).toUpperCase();
            }
        })
        .catch(err => console.error('Auth sync error:', err));
    }

    function handleProfileClick() {
        if (!state.token) {
            showModal('auth-modal');
        } else {
            fetchOrderHistory();
            showModal('profile-modal');
        }
    }

    // --- ORDER HISTORY ---
    function fetchOrderHistory() {
        const list = document.getElementById('profile-orders-list');
        list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Loading your orders...</div>';

        fetch('/api/orders', { headers: { 'Authorization': `Bearer ${state.token}` } })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                list.innerHTML = `<div style="color:#ff4c4c; text-align:center; padding:30px;">${data.error}</div>`;
                return;
            }

            if (!data.orders || data.orders.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; color:var(--text-muted); padding:50px 0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3; display:block; margin:0 auto 15px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                        <p style="font-size:1rem; margin-bottom:15px;">No orders yet</p>
                        <a href="products.html" style="color:var(--brand-gold); text-decoration:none; font-size:0.9rem; border:1px solid var(--brand-gold); padding:8px 20px; border-radius:4px;">Start Shopping →</a>
                    </div>
                `;
                return;
            }

            list.innerHTML = data.orders.map(order => {
                const oDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const dDate = new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

                const now = new Date();
                const delivery = new Date(order.estimatedDeliveryDate);
                const isDelivered = now > delivery;
                const progressPct = isDelivered ? 100 : Math.min(100, Math.round(((now - new Date(order.createdAt)) / (delivery - new Date(order.createdAt))) * 100));

                return `
                <div class="order-card">
                    <div class="order-card-header">
                        <div>
                            <div class="order-id">${order.id}</div>
                            <div class="order-date">Placed on ${oDate}</div>
                        </div>
                        <span class="order-status-badge">${isDelivered ? '✓ Delivered' : '🚛 In Transit'}</span>
                    </div>
                    <div class="order-items-summary">
                        ${order.items.map(i => `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.04);"><span>• ${i.name} <span style="color:var(--text-muted);">× ${i.quantity}</span></span><span style="color:var(--text-muted);">₹${(i.price * i.quantity).toLocaleString('en-IN')}</span></div>`).join('')}
                    </div>
                    <div class="delivery-tracker">
                        <div class="tracker-timeline">
                            <div class="tracker-timeline-progress" style="width:${progressPct}%;"></div>
                            <div class="tracker-node ${progressPct >= 0 ? 'active' : ''}">✓</div>
                            <div class="tracker-node ${progressPct >= 50 ? 'active' : ''}">📦</div>
                            <div class="tracker-node ${isDelivered ? 'active' : ''}">🏠</div>
                        </div>
                        <div class="tracker-labels">
                            <div class="tracker-label active">Ordered</div>
                            <div class="tracker-label ${progressPct >= 50 ? 'active' : ''}">Shipped</div>
                            <div class="tracker-label ${isDelivered ? 'active' : ''}">Delivered</div>
                        </div>
                    </div>
                    <div class="delivery-estimate-banner">
                        ${isDelivered ? '✅ Delivered on ' + dDate : '🗓️ Expected by ' + dDate}
                    </div>
                    <div class="order-card-footer">
                        <div class="order-total">₹${order.total.toLocaleString('en-IN')} <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(COD)</span></div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${order.shippingDetails.city}, ${order.shippingDetails.state}</div>
                    </div>
                </div>
                `;
            }).join('');
        })
        .catch(err => {
            console.error(err);
            list.innerHTML = '<div style="color:#ff4c4c; text-align:center; padding:30px;">Failed to load orders. Please try again.</div>';
        });
    }
})();
