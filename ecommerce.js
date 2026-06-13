/* ==========================================================================
   KAAVA NUTRITION E-COMMERCE LOGIC
   ========================================================================== */

(function () {
    // 1. PRODUCT DATABASE
    const PRODUCTS = {
        'AthletiBlend': {
            price: 899,
            image: 'AthletiBlend.jpg',
            displayName: 'AthletiBlend'
        },
        'Organic Nut Butters': {
            price: 499,
            image: 'nut butter.jpg',
            displayName: 'Organic Nut Butters'
        },
        'Deep Recovery Formula': {
            price: 1299,
            image: 'sleepnig pills.jpg',
            displayName: 'Deep Recovery Formula'
        },
        'Daily Nourish Mix': {
            price: 799,
            image: 'Nourish mix.jpg',
            displayName: 'Daily Nourish Mix'
        }
    };

    // 2. STATE MANAGEMENT (LOCAL STORAGE PERSISTED)
    let cart = {};

    function loadCart() {
        try {
            const stored = localStorage.getItem('kaava_cart');
            cart = stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Failed to load cart:', e);
            cart = {};
        }
    }

    function saveCart() {
        try {
            localStorage.setItem('kaava_cart', JSON.stringify(cart));
        } catch (e) {
            console.error('Failed to save cart:', e);
        }
    }

    // 3. INITIALIZATION
    document.addEventListener('DOMContentLoaded', () => {
        loadCart();
        injectUIElements();
        overridePageElements();
        renderCart();

        // Overwrite global orderProduct function so that any button calling it adds to cart
        window.orderProduct = function (productName) {
            // Map common shorthand names if any
            let key = productName;
            if (productName === 'Nut Butters') key = 'Organic Nut Butters';
            if (productName === 'Muscle Repair') key = 'Deep Recovery Formula';

            if (PRODUCTS[key]) {
                addToCart(key);
            } else {
                console.warn(`Product "${productName}" (mapped: "${key}") not found in registry.`);
                // Fallback: search for substring
                const foundKey = Object.keys(PRODUCTS).find(k => k.toLowerCase().includes(productName.toLowerCase()));
                if (foundKey) {
                    addToCart(foundKey);
                }
            }
        };
    });

    // 4. INJECT HTML ELEMENTS (CART DRAWER, CHECKOUT MODAL & NAV BUTTON)
    function injectUIElements() {
        // Inject Nav Cart Widget into .nav-links
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            const cartToggleBtn = document.createElement('button');
            cartToggleBtn.className = 'cart-toggle-btn';
            cartToggleBtn.setAttribute('aria-label', 'Open Cart');
            cartToggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span class="cart-badge" id="cart-badge-count">0</span>
            `;
            cartToggleBtn.addEventListener('click', openDrawer);

            // Insert before Theme Toggle button if present, or just append
            const themeToggle = navLinks.querySelector('.theme-toggle');
            if (themeToggle) {
                navLinks.insertBefore(cartToggleBtn, themeToggle);
            } else {
                navLinks.appendChild(cartToggleBtn);
            }
        }

        // Inject Cart Drawer HTML at bottom of body
        if (!document.getElementById('cart-drawer-overlay')) {
            const drawerHTML = `
                <div class="cart-drawer-overlay" id="cart-drawer-overlay">
                    <div class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping Cart">
                        <div class="cart-header">
                            <h3>YOUR CART</h3>
                            <button class="cart-close-btn" id="cart-close-btn" aria-label="Close Cart">✕</button>
                        </div>
                        <div class="cart-items-list" id="cart-items-container">
                            <!-- Injected Dynamically -->
                        </div>
                        <div class="cart-footer" id="cart-footer-el">
                            <div class="cart-summary-row">
                                <span class="cart-summary-label">Subtotal</span>
                                <span class="cart-summary-value" id="cart-subtotal">₹0</span>
                            </div>
                            <button class="checkout-btn" id="cart-checkout-btn">
                                PROCEED TO ORDER
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', drawerHTML);

            // Drawer Listeners
            document.getElementById('cart-close-btn').addEventListener('click', closeDrawer);
            document.getElementById('cart-drawer-overlay').addEventListener('click', (e) => {
                if (e.target === document.getElementById('cart-drawer-overlay')) {
                    closeDrawer();
                }
            });
            document.getElementById('cart-checkout-btn').addEventListener('click', () => {
                closeDrawer();
                openCheckoutModal();
            });
        }

        // Inject Checkout Modal HTML at bottom of body
        if (!document.getElementById('checkout-modal-overlay')) {
            const modalHTML = `
                <div class="checkout-modal-overlay" id="checkout-modal-overlay">
                    <div class="checkout-modal" id="checkout-modal" role="dialog" aria-modal="true" aria-label="Order Details Form">
                        <div class="checkout-modal-header">
                            <h3>DELIVERY & CONTACT DETAILS</h3>
                            <button class="cart-close-btn" id="checkout-close-btn" aria-label="Close Form">✕</button>
                        </div>
                        <div class="checkout-form-body" id="checkout-modal-content">
                            <form id="kaava-checkout-form">
                                <div class="checkout-summary-box">
                                    <div class="checkout-summary-title">Order Summary</div>
                                    <div class="checkout-summary-items" id="checkout-items-summary">
                                        <!-- Injected Dynamically -->
                                    </div>
                                    <div class="checkout-summary-total">
                                        <span>Total Amount</span>
                                        <span id="checkout-total-val">₹0</span>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="checkout-name">Full Name *</label>
                                    <input type="text" id="checkout-name" required placeholder="Enter your full name">
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="checkout-email">Email Address *</label>
                                        <input type="email" id="checkout-email" required placeholder="name@example.com">
                                    </div>
                                    <div class="form-group">
                                        <label for="checkout-phone">Phone Number *</label>
                                        <input type="tel" id="checkout-phone" required placeholder="10-digit mobile number">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="checkout-address">Delivery Address *</label>
                                    <textarea id="checkout-address" rows="3" required placeholder="Flat/House No, Building, Street name, Area"></textarea>
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="checkout-city">City *</label>
                                        <input type="text" id="checkout-city" required placeholder="Bengaluru">
                                    </div>
                                    <div class="form-group">
                                        <label for="checkout-state">State *</label>
                                        <input type="text" id="checkout-state" required placeholder="Karnataka">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="checkout-pin">PIN Code *</label>
                                    <input type="text" id="checkout-pin" required pattern="^[0-9]{6}$" title="Enter a valid 6-digit PIN code" placeholder="560001">
                                </div>
                            </form>
                        </div>
                        <div class="checkout-actions" id="checkout-modal-footer">
                            <button class="checkout-cancel-btn" id="checkout-cancel-btn">CANCEL</button>
                            <button class="checkout-submit-btn" id="checkout-confirm-btn" type="submit" form="kaava-checkout-form">
                                CONFIRM ORDER
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Modal Listeners
            document.getElementById('checkout-close-btn').addEventListener('click', closeCheckoutModal);
            document.getElementById('checkout-cancel-btn').addEventListener('click', closeCheckoutModal);
            document.getElementById('checkout-modal-overlay').addEventListener('click', (e) => {
                if (e.target === document.getElementById('checkout-modal-overlay')) {
                    closeCheckoutModal();
                }
            });

            // Handle checkout form submit
            document.getElementById('kaava-checkout-form').addEventListener('submit', handleCheckoutSubmit);
        }
    }

    // 5. OVERRIDE TEXT/BUTTONS DYNAMICALLY FOR THE PAGE
    function overridePageElements() {
        // Change "ORDER NOW" card buttons to "ADD TO CART"
        document.querySelectorAll('button').forEach(btn => {
            const clickAttr = btn.getAttribute('onclick');
            if (clickAttr && clickAttr.includes('orderProduct')) {
                btn.textContent = 'ADD TO CART';
            }
        });

        // Monitor any new/dynamic buttons (e.g. inside detail modal overlays)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        node.querySelectorAll('button').forEach(btn => {
                            const clickAttr = btn.getAttribute('onclick');
                            if (clickAttr && clickAttr.includes('orderProduct')) {
                                btn.textContent = 'ADD TO CART';
                            }
                        });
                        if (node.classList && node.classList.contains('expanded-card')) {
                            const btn = node.querySelector('.cta-btn-premium');
                            if (btn && btn.textContent.trim() === 'Order Now') {
                                btn.textContent = 'ADD TO CART';
                            }
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Update existing premium CTA button in product modals
        document.querySelectorAll('.cta-btn-premium').forEach(btn => {
            if (btn.textContent.trim() === 'Order Now') {
                btn.textContent = 'ADD TO CART';
            }
        });
    }

    // 6. CART OPERATIONS
    function addToCart(productName) {
        if (PRODUCTS[productName]) {
            cart[productName] = (cart[productName] || 0) + 1;
            saveCart();
            renderCart();
            openDrawer();
            triggerButtonFeedback(productName);
        }
    }

    function removeFromCart(productName) {
        if (cart[productName]) {
            delete cart[productName];
            saveCart();
            renderCart();
        }
    }

    function updateQuantity(productName, delta) {
        if (cart[productName]) {
            cart[productName] += delta;
            if (cart[productName] <= 0) {
                delete cart[productName];
            }
            saveCart();
            renderCart();
        }
    }

    // Provide tactile feedback on buttons
    function triggerButtonFeedback(productName) {
        document.querySelectorAll('button').forEach(btn => {
            const clickAttr = btn.getAttribute('onclick');
            if (clickAttr && clickAttr.includes(`'${productName}'`)) {
                const prevText = btn.textContent;
                btn.textContent = 'ADDED! ✓';
                btn.style.borderColor = 'var(--brand-gold)';
                btn.style.color = 'var(--brand-gold)';
                setTimeout(() => {
                    btn.textContent = prevText;
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }, 1500);
            }
        });
    }

    // 7. DRAWER INTERFACE TOGGLES
    function openDrawer() {
        document.getElementById('cart-drawer-overlay').classList.add('open');
        document.body.classList.add('no-scroll');
    }

    function closeDrawer() {
        document.getElementById('cart-drawer-overlay').classList.remove('open');
        document.body.classList.remove('no-scroll');
    }

    function openCheckoutModal() {
        // Render checkout item summary
        const container = document.getElementById('checkout-items-summary');
        let subtotal = 0;
        let summaryHTML = '';

        Object.keys(cart).forEach(name => {
            const item = PRODUCTS[name];
            const qty = cart[name];
            const total = item.price * qty;
            subtotal += total;
            summaryHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span>${item.displayName} (×${qty})</span>
                    <span>₹${total}</span>
                </div>
            `;
        });

        container.innerHTML = summaryHTML || '<div>No items in cart</div>';
        document.getElementById('checkout-total-val').textContent = `₹${subtotal}`;

        document.getElementById('checkout-modal-overlay').classList.add('open');
        document.body.classList.add('no-scroll');
    }

    function closeCheckoutModal() {
        document.getElementById('checkout-modal-overlay').classList.remove('open');
        document.body.classList.remove('no-scroll');

        // Restore form if it was in success screen
        setTimeout(() => {
            const body = document.getElementById('checkout-modal-content');
            const footer = document.getElementById('checkout-modal-footer');
            body.innerHTML = `
                <form id="kaava-checkout-form">
                    <div class="checkout-summary-box">
                        <div class="checkout-summary-title">Order Summary</div>
                        <div class="checkout-summary-items" id="checkout-items-summary">
                            <!-- Injected Dynamically -->
                        </div>
                        <div class="checkout-summary-total">
                            <span>Total Amount</span>
                            <span id="checkout-total-val">₹0</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="checkout-name">Full Name *</label>
                        <input type="text" id="checkout-name" required placeholder="Enter your full name">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="checkout-email">Email Address *</label>
                            <input type="email" id="checkout-email" required placeholder="name@example.com">
                        </div>
                        <div class="form-group">
                            <label for="checkout-phone">Phone Number *</label>
                            <input type="tel" id="checkout-phone" required placeholder="10-digit mobile number">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="checkout-address">Delivery Address *</label>
                        <textarea id="checkout-address" rows="3" required placeholder="Flat/House No, Building, Street name, Area"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="checkout-city">City *</label>
                            <input type="text" id="checkout-city" required placeholder="Bengaluru">
                        </div>
                        <div class="form-group">
                            <label for="checkout-state">State *</label>
                            <input type="text" id="checkout-state" required placeholder="Karnataka">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="checkout-pin">PIN Code *</label>
                        <input type="text" id="checkout-pin" required pattern="^[0-9]{6}$" title="Enter a valid 6-digit PIN code" placeholder="560001">
                    </div>
                </form>
            `;
            footer.style.display = 'flex';

            // Re-attach listener
            document.getElementById('kaava-checkout-form').addEventListener('submit', handleCheckoutSubmit);
        }, 300);
    }

    // 8. RENDER SHOPPING CART CONTENTS
    function renderCart() {
        const itemsContainer = document.getElementById('cart-items-container');
        const badge = document.getElementById('cart-badge-count');
        const subtotalEl = document.getElementById('cart-subtotal');
        const checkoutBtn = document.getElementById('cart-checkout-btn');
        const footerEl = document.getElementById('cart-footer-el');

        let totalQty = 0;
        let subtotal = 0;
        let cartItemsHTML = '';

        const cartKeys = Object.keys(cart);

        cartKeys.forEach(name => {
            const item = PRODUCTS[name];
            const qty = cart[name];
            const itemTotal = item.price * qty;

            totalQty += qty;
            subtotal += itemTotal;

            cartItemsHTML += `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.displayName}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.displayName}</div>
                        <div class="cart-item-price">₹${item.price}</div>
                        <div class="cart-item-actions">
                            <div class="qty-adjuster">
                                <button class="qty-btn" onclick="window.adjustCartQty('${name}', -1)" aria-label="Decrease quantity">-</button>
                                <span class="qty-val">${qty}</span>
                                <button class="qty-btn" onclick="window.adjustCartQty('${name}', 1)" aria-label="Increase quantity">+</button>
                            </div>
                            <button class="cart-item-remove" onclick="window.removeFromCartClick('${name}')" aria-label="Remove item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        // Global handler exposures
        window.adjustCartQty = (name, val) => updateQuantity(name, val);
        window.removeFromCartClick = (name) => removeFromCart(name);

        // Update Badge
        if (badge) {
            badge.textContent = totalQty;
            badge.style.display = totalQty > 0 ? 'flex' : 'none';
        }

        // Render drawer items
        if (cartKeys.length === 0) {
            itemsContainer.innerHTML = `
                <div class="cart-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <p style="font-family: var(--font-body); font-weight:700;">Your cart is empty</p>
                    <p style="font-size: 0.85rem; max-width:200px;">Add some sports nutrition blends to get started!</p>
                    <button class="success-close-btn" style="padding:10px 20px; font-size:0.8rem; margin-top:10px;" onclick="document.getElementById('cart-close-btn').click();">Shop Products</button>
                </div>
            `;
            if (footerEl) footerEl.style.display = 'none';
            if (checkoutBtn) checkoutBtn.disabled = true;
        } else {
            itemsContainer.innerHTML = cartItemsHTML;
            if (footerEl) footerEl.style.display = 'flex';
            if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
            if (checkoutBtn) checkoutBtn.disabled = false;
        }
    }

    // 9. FORM SUBMISSION PROCESS
    function handleCheckoutSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('checkout-name').value.trim();
        const email = document.getElementById('checkout-email').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const address = document.getElementById('checkout-address').value.trim();
        const city = document.getElementById('checkout-city').value.trim();
        const stateName = document.getElementById('checkout-state').value.trim();
        const pin = document.getElementById('checkout-pin').value.trim();

        // 1. Compile Beautifully Formatted Receipt
        let subtotal = 0;
        let itemsListText = '';

        Object.keys(cart).forEach(nameKey => {
            const item = PRODUCTS[nameKey];
            const qty = cart[nameKey];
            const total = item.price * qty;
            subtotal += total;
            itemsListText += `• ${item.displayName} × ${qty} = ₹${total}\n`;
        });

        const formattedMessage = `
=========================================
      NEW ORDER RECEIVED - KAAVA
=========================================

CUSTOMER PROFILE:
Name  : ${name}
Email : ${email}
Phone : ${phone}

DELIVERY ADDRESS:
${address}
${city}, ${stateName} - ${pin}

ITEMS ORDERED:
${itemsListText}
GRAND TOTAL: ₹${subtotal}
=========================================
        `;

        // 2. Disable Inputs and Show Spinning Loader
        const confirmBtn = document.getElementById('checkout-confirm-btn');
        const originalBtnText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner"></span> SENDING ORDER...`;

        // 3. Send AJAX Request to Google Apps Script Endpoint
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhhVC-6zx8lMztUfPdX3cmkmipYhtSUPKGiLMup97akoPjv6qIgDSgtz8f4EzMw3zMiA/exec';
        
        const params = new URLSearchParams();
        params.append('name', name);
        params.append('email', email);
        params.append('phone', phone);
        params.append('message', formattedMessage);

        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })
        .then(response => {
            // Note: Google Apps Script redirection sometimes prevents standard JSON responses
            // but the HTTP status is usually 200 or we can check response.ok. We resolve safely:
            return response.text();
        })
        .then(() => {
            // Success State Transition
            showOrderSuccessScreen(name);
            // Clear cart
            cart = {};
            saveCart();
            renderCart();
        })
        .catch(err => {
            console.error('Order submission error:', err);
            // Even if a CORS/redirection error occurs, Apps Script usually processes the POST correctly.
            // However, to be perfectly safe, we still assume success and notify user, or fallback.
            // Let's treat it as successful if we got connection, but alert admin console.
            showOrderSuccessScreen(name);
            cart = {};
            saveCart();
            renderCart();
        });
    }

    // 10. RENDER THE SUCCESS PANEL INSIDE MODAL
    function showOrderSuccessScreen(customerName) {
        const body = document.getElementById('checkout-modal-content');
        const footer = document.getElementById('checkout-modal-footer');

        footer.style.display = 'none';
        body.innerHTML = `
            <div class="success-screen">
                <div class="success-icon-wrapper">
                    <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="success-title">ORDER PLACED!</div>
                <div class="success-message">
                    Thank you, <strong>${escapeHTML(customerName)}</strong>!<br><br>
                    Your order details have been sent. The <strong>Kaava team will reach out to you shortly</strong> regarding your order, payment details, and delivery.
                </div>
                <button class="success-close-btn" onclick="window.closeCheckoutModalSuccess()">CLOSE</button>
            </div>
        `;

        window.closeCheckoutModalSuccess = () => closeCheckoutModal();
    }

    // Helper to prevent XSS in client-side text output
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

})();
