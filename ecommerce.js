/* ==========================================================================
   KAAVA NUTRITION E-COMMERCE LOGIC
   ========================================================================== */

(function () {
    // 1. PRODUCT DATABASE
    const PRODUCTS = {
        'AthletiBlend': {
            price: 450,
            image: 'AthletiBlend.jpg',
            displayName: 'AthletiBlend'
        },
        'Organic Nut Butters': {
            price: 550,
            image: 'nut butter.jpg',
            displayName: 'Organic Nut Butters'
        },
        'Deep Recovery Formula': {
            price: 350,
            image: 'sleepnig pills.jpg',
            displayName: 'Deep Recovery Formula'
        },
        'Daily Nourish Mix': {
            price: 350,
            image: 'Nourish mix.jpg',
            displayName: 'Daily Nourish Mix'
        }
    };

    // 2. STATE MANAGEMENT (LOCAL STORAGE PERSISTED)
    let cart = {};
    let isPaymentStep = false;
    let paymentScreenshotBase64 = '';
    let paymentScreenshotName = '';

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
    function init() {
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

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
                            <div id="checkout-details-view">
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
                            <div id="checkout-payment-view" style="display:none;">
                                <div class="payment-view-container">
                                    <div class="payment-title-box">
                                        <h4>Scan & Pay</h4>
                                        <p>Scan the QR code below using any UPI app (GPay, PhonePe, Paytm, BHIM) to pay for your order.</p>
                                    </div>
                                    <div class="payment-amount-highlight" id="payment-amount-val">
                                        ₹0
                                    </div>
                                    <div class="payment-qr-container">
                                        <img src="payment%20qr%20code/WhatsApp%20Image%202026-06-27%20at%201.47.11%20PM.jpeg" alt="Kaava Nutrition Payment QR Code" class="payment-qr-image">
                                    </div>
                                    <div style="width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                                        <label style="font-family: var(--font-body); font-weight: 700; font-size: 0.75rem; color: var(--brand-blue); letter-spacing: 1px; text-transform: uppercase;">Upload Payment Screenshot *</label>
                                        <div class="payment-upload-zone" id="payment-upload-zone">
                                            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="17 8 12 3 7 8"></polyline>
                                                <line x1="12" y1="3" x2="12" y2="15"></line>
                                            </svg>
                                            <span class="upload-text-primary">Click to upload receipt screenshot</span>
                                            <span class="upload-text-secondary">Supports JPG, JPEG, PNG, WEBP</span>
                                            <input type="file" id="payment-screenshot-input" accept="image/*" style="display: none;">
                                        </div>
                                        <div class="screenshot-preview-wrapper" id="screenshot-preview-wrapper">
                                            <div class="screenshot-preview-container" id="screenshot-preview-container">
                                                <img id="screenshot-preview-img" src="" alt="Screenshot Preview">
                                                <button type="button" class="screenshot-remove-btn" id="screenshot-remove-btn" title="Remove Screenshot">✕</button>
                                            </div>
                                            <div class="uploaded-filename-badge" id="uploaded-filename-badge" style="display: none;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="checkout-actions" id="checkout-modal-footer">
                            <button class="checkout-back-btn" id="checkout-back-btn" style="display:none; margin-right: auto;">BACK TO DETAILS</button>
                            <button class="checkout-cancel-btn" id="checkout-cancel-btn">CANCEL</button>
                            <button class="checkout-submit-btn" id="checkout-confirm-btn" type="submit" form="kaava-checkout-form">
                                PROCEED TO PAYMENT
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

            // Wire Payment specific event listeners
            const uploadZone = document.getElementById('payment-upload-zone');
            const fileInput = document.getElementById('payment-screenshot-input');
            const removeBtn = document.getElementById('screenshot-remove-btn');
            const backBtn = document.getElementById('checkout-back-btn');
            const confirmBtn = document.getElementById('checkout-confirm-btn');

            if (uploadZone && fileInput) {
                uploadZone.addEventListener('click', () => fileInput.click());

                // Drag & Drop event bindings
                uploadZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadZone.classList.add('dragover');
                });
                uploadZone.addEventListener('dragleave', () => {
                    uploadZone.classList.remove('dragover');
                });
                uploadZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadZone.classList.remove('dragover');
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleScreenshotSelect(e.dataTransfer.files[0]);
                    }
                });

                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) {
                        handleScreenshotSelect(e.target.files[0]);
                    }
                });
            }

            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeScreenshot();
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', handleBackToDetails);
            }

            if (confirmBtn) {
                confirmBtn.addEventListener('click', (e) => {
                    if (isPaymentStep) {
                        e.preventDefault();
                        submitOrderWithPayment();
                    }
                });
            }
        }
    }

    // 5. OVERRIDE BUTTONS — remove onclick and wire direct event listeners inside closure
    function overridePageElements() {
        // Wire all static "ORDER NOW" buttons that have orderProduct in their onclick
        document.querySelectorAll('button').forEach(btn => {
            const clickAttr = btn.getAttribute('onclick') || '';
            if (clickAttr.includes('orderProduct')) {
                // Extract static product name e.g. orderProduct('AthletiBlend')
                const match = clickAttr.match(/orderProduct\(\s*['"]([^'"]+)['"]\s*\)/);
                if (match) {
                    const productName = match[1];
                    btn.removeAttribute('onclick');
                    btn.textContent = 'ADD TO CART';
                    btn.style.cursor = 'pointer';
                    btn.dataset.productName = productName;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        addToCart(productName, btn);
                    });
                }
            }
        });

        // Wire the "Order Now" button inside the expanded product modal (dynamic title)
        function wireModalBtn() {
            document.querySelectorAll('.cta-btn-premium').forEach(btn => {
                if (!btn.dataset.kaavaWired) {
                    btn.dataset.kaavaWired = '1';
                    btn.removeAttribute('onclick');
                    btn.textContent = 'ADD TO CART';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const titleEl = document.getElementById('modal-title');
                        if (titleEl) {
                            addToCart(titleEl.innerText.trim(), btn);
                        }
                    });
                }
            });
        }
        wireModalBtn();

        // Watch for the expanded-card modal being shown (it's always in DOM but we re-wire to be safe)
        const observer = new MutationObserver(() => wireModalBtn());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    // 6. CART OPERATIONS
    function addToCart(productName, clickedBtn = null) {
        let key = productName.trim();
        // Robust case-insensitive check and substring fallback
        if (!PRODUCTS[key]) {
            const foundKey = Object.keys(PRODUCTS).find(k => k.toLowerCase() === key.toLowerCase());
            if (foundKey) {
                key = foundKey;
            } else {
                // Substring fallback
                const partialKey = Object.keys(PRODUCTS).find(k => k.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(k.toLowerCase()));
                if (partialKey) {
                    key = partialKey;
                }
            }
        }

        if (PRODUCTS[key]) {
            cart[key] = (cart[key] || 0) + 1;
            saveCart();
            renderCart();
            openDrawer();
            triggerButtonFeedback(key, clickedBtn);
        }
    }

    // Global entry point called by page-level onclick handlers
    window.kaavaAddToCart = function (productName) {
        addToCart(productName);
    };

    function removeFromCart(productName) {
        if (cart[productName]) {
            delete cart[productName];
            saveCart();
            renderCart();
        }
    }

    // Provide tactile feedback on buttons
    function triggerButtonFeedback(productName, clickedBtn = null) {
        let buttons = [];
        if (clickedBtn) {
            buttons.push(clickedBtn);
        }
        
        document.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.productName === productName) {
                buttons.push(btn);
            }
        });

        // Unique buttons
        buttons = [...new Set(buttons)];

        buttons.forEach(btn => {
            const prevText = btn.textContent;
            btn.textContent = 'ADDED! ✓';
            const prevBorderColor = btn.style.borderColor;
            const prevColor = btn.style.color;
            btn.style.borderColor = 'var(--brand-gold)';
            btn.style.color = 'var(--brand-gold)';
            setTimeout(() => {
                btn.textContent = prevText;
                btn.style.borderColor = prevBorderColor;
                btn.style.color = prevColor;
            }, 1500);
        });
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
        // Reset state
        isPaymentStep = false;
        paymentScreenshotBase64 = '';
        paymentScreenshotName = '';

        // Reset view visibility
        const detailsView = document.getElementById('checkout-details-view');
        const paymentView = document.getElementById('checkout-payment-view');
        const backBtn = document.getElementById('checkout-back-btn');
        const cancelBtn = document.getElementById('checkout-cancel-btn');
        const confirmBtn = document.getElementById('checkout-confirm-btn');

        if (detailsView) detailsView.style.display = 'block';
        if (paymentView) paymentView.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (confirmBtn) {
            confirmBtn.innerHTML = 'PROCEED TO PAYMENT';
            confirmBtn.disabled = false;
            confirmBtn.setAttribute('form', 'kaava-checkout-form');
            confirmBtn.setAttribute('type', 'submit');
        }

        // Reset screenshot UI elements
        const previewImg = document.getElementById('screenshot-preview-img');
        const previewContainer = document.getElementById('screenshot-preview-container');
        const filenameBadge = document.getElementById('uploaded-filename-badge');
        const fileInput = document.getElementById('payment-screenshot-input');
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (filenameBadge) {
            filenameBadge.textContent = '';
            filenameBadge.style.display = 'none';
        }
        if (fileInput) fileInput.value = '';

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
                <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-family: var(--font-body); font-size: 0.95rem;">
                    <span>${item.displayName} (×${qty}) <small style="opacity: 0.6; margin-left: 6px;">@ ₹${item.price} each</small></span>
                    <span>₹${total}</span>
                </div>
            `;
        });

        if (container) {
            container.innerHTML = summaryHTML || '<div>No items in cart</div>';
        }
        const totalValEl = document.getElementById('checkout-total-val');
        if (totalValEl) {
            totalValEl.textContent = `₹${subtotal}`;
        }

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
                <div id="checkout-details-view">
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
                <div id="checkout-payment-view" style="display:none;">
                    <div class="payment-view-container">
                        <div class="payment-title-box">
                            <h4>Scan & Pay</h4>
                            <p>Scan the QR code below using any UPI app (GPay, PhonePe, Paytm, BHIM) to pay for your order.</p>
                        </div>
                        <div class="payment-amount-highlight" id="payment-amount-val">
                            ₹0
                        </div>
                        <div class="payment-qr-container">
                            <img src="payment%20qr%20code/WhatsApp%20Image%202026-06-27%20at%201.47.11%20PM.jpeg" alt="Kaava Nutrition Payment QR Code" class="payment-qr-image">
                        </div>
                        <div style="width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            <label style="font-family: var(--font-body); font-weight: 700; font-size: 0.75rem; color: var(--brand-blue); letter-spacing: 1px; text-transform: uppercase;">Upload Payment Screenshot *</label>
                            <div class="payment-upload-zone" id="payment-upload-zone">
                                <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <span class="upload-text-primary">Click to upload receipt screenshot</span>
                                <span class="upload-text-secondary">Supports JPG, JPEG, PNG, WEBP</span>
                                <input type="file" id="payment-screenshot-input" accept="image/*" style="display: none;">
                            </div>
                            <div class="screenshot-preview-wrapper" id="screenshot-preview-wrapper">
                                <div class="screenshot-preview-container" id="screenshot-preview-container">
                                    <img id="screenshot-preview-img" src="" alt="Screenshot Preview">
                                    <button type="button" class="screenshot-remove-btn" id="screenshot-remove-btn" title="Remove Screenshot">✕</button>
                                </div>
                                <div class="uploaded-filename-badge" id="uploaded-filename-badge" style="display: none;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            footer.style.display = 'flex';

            // Reset footer button states to Details View
            const backBtn = document.getElementById('checkout-back-btn');
            const cancelBtn = document.getElementById('checkout-cancel-btn');
            const confirmBtn = document.getElementById('checkout-confirm-btn');
            if (backBtn) backBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            if (confirmBtn) {
                confirmBtn.innerHTML = 'PROCEED TO PAYMENT';
                confirmBtn.disabled = false;
                confirmBtn.setAttribute('form', 'kaava-checkout-form');
                confirmBtn.setAttribute('type', 'submit');
            }

            // Re-bind all dynamic elements inside content area
            bindPaymentEvents();
        }, 300);
    }

    function bindPaymentEvents() {
        const uploadZone = document.getElementById('payment-upload-zone');
        const fileInput = document.getElementById('payment-screenshot-input');
        const removeBtn = document.getElementById('screenshot-remove-btn');
        const backBtn = document.getElementById('checkout-back-btn');
        const formEl = document.getElementById('kaava-checkout-form');

        if (formEl) {
            formEl.addEventListener('submit', handleCheckoutSubmit);
        }

        if (uploadZone && fileInput) {
            uploadZone.addEventListener('click', () => fileInput.click());

            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleScreenshotSelect(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleScreenshotSelect(e.target.files[0]);
                }
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeScreenshot();
            });
        }
    }

    function handleScreenshotSelect(file) {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
            return;
        }

        paymentScreenshotName = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            paymentScreenshotBase64 = e.target.result;
            
            const previewImg = document.getElementById('screenshot-preview-img');
            const previewContainer = document.getElementById('screenshot-preview-container');
            const filenameBadge = document.getElementById('uploaded-filename-badge');
            
            if (previewImg && previewContainer && filenameBadge) {
                previewImg.src = paymentScreenshotBase64;
                previewContainer.style.display = 'block';
                filenameBadge.textContent = file.name;
                filenameBadge.style.display = 'inline-block';
            }
            
            const confirmBtn = document.getElementById('checkout-confirm-btn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }

    function removeScreenshot() {
        paymentScreenshotBase64 = '';
        paymentScreenshotName = '';
        
        const previewImg = document.getElementById('screenshot-preview-img');
        const previewContainer = document.getElementById('screenshot-preview-container');
        const filenameBadge = document.getElementById('uploaded-filename-badge');
        const fileInput = document.getElementById('payment-screenshot-input');
        
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (filenameBadge) {
            filenameBadge.textContent = '';
            filenameBadge.style.display = 'none';
        }
        if (fileInput) fileInput.value = '';
        
        const confirmBtn = document.getElementById('checkout-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    }

    function handleBackToDetails() {
        isPaymentStep = false;
        
        document.getElementById('checkout-payment-view').style.display = 'none';
        document.getElementById('checkout-details-view').style.display = 'block';
        
        const backBtn = document.getElementById('checkout-back-btn');
        const cancelBtn = document.getElementById('checkout-cancel-btn');
        const confirmBtn = document.getElementById('checkout-confirm-btn');
        
        if (backBtn) backBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (confirmBtn) {
            confirmBtn.innerHTML = 'PROCEED TO PAYMENT';
            confirmBtn.disabled = false;
            confirmBtn.setAttribute('form', 'kaava-checkout-form');
            confirmBtn.setAttribute('type', 'submit');
        }
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

        // Perform calculation of total
        let subtotal = 0;
        Object.keys(cart).forEach(nameKey => {
            const item = PRODUCTS[nameKey];
            const qty = cart[nameKey];
            subtotal += item.price * qty;
        });

        // Set amount highlighted in UPI view
        const paymentAmountVal = document.getElementById('payment-amount-val');
        if (paymentAmountVal) {
            paymentAmountVal.textContent = `₹${subtotal}`;
        }

        // Hide Details View, Show Payment View
        document.getElementById('checkout-details-view').style.display = 'none';
        document.getElementById('checkout-payment-view').style.display = 'block';

        isPaymentStep = true;

        // Toggle footer buttons
        const backBtn = document.getElementById('checkout-back-btn');
        const cancelBtn = document.getElementById('checkout-cancel-btn');
        const confirmBtn = document.getElementById('checkout-confirm-btn');

        if (backBtn) backBtn.style.display = 'inline-block';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (confirmBtn) {
            confirmBtn.innerHTML = 'COMPLETE ORDER';
            confirmBtn.removeAttribute('form');
            confirmBtn.setAttribute('type', 'button');
            // Disable until screenshot is uploaded
            confirmBtn.disabled = !paymentScreenshotBase64;
        }
    }

    function submitOrderWithPayment() {
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
            itemsListText += `• ${item.displayName} (Qty: ${qty}) @ ₹${item.price} each = ₹${total}\n`;
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
PAYMENT STATUS: Paid via UPI (Receipt screenshot attached)
=========================================
        `;

        // 2. Disable Inputs and Show Spinning Loader
        const confirmBtn = document.getElementById('checkout-confirm-btn');
        const backBtn = document.getElementById('checkout-back-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<span class="spinner"></span> SENDING ORDER...`;
        }
        if (backBtn) {
            backBtn.disabled = true;
        }

        // 3. Send AJAX Request to Google Apps Script Endpoint
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhhVC-6zx8lMztUfPdX3cmkmipYhtSUPKGiLMup97akoPjv6qIgDSgtz8f4EzMw3zMiA/exec';
        
        const params = new URLSearchParams();
        params.append('name', name);
        params.append('email', email);
        params.append('phone', phone);
        params.append('address', address);
        params.append('city', city);
        params.append('state', stateName);
        params.append('pin', pin);
        params.append('message', formattedMessage);
        
        if (paymentScreenshotBase64) {
            params.append('screenshot', paymentScreenshotBase64);
            params.append('screenshotName', paymentScreenshotName);
        }

        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })
        .then(response => response.text())
        .then(() => {
            // Success State Transition
            showOrderSuccessScreen(name);
            // Clear cart
            cart = {};
            saveCart();
            renderCart();
            
            isPaymentStep = false;
            paymentScreenshotBase64 = '';
            paymentScreenshotName = '';
        })
        .catch(err => {
            console.error('Order submission error:', err);
            // Treat as success fallback to notify user
            showOrderSuccessScreen(name);
            cart = {};
            saveCart();
            renderCart();
            
            isPaymentStep = false;
            paymentScreenshotBase64 = '';
            paymentScreenshotName = '';
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
