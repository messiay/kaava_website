const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware for body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data files directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database helper paths
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const EMAILS_FILE = path.join(DATA_DIR, 'email_logs.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Helper to initialize JSON files
const initFile = (filePath, defaultData) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
};

initFile(USERS_FILE, []);
initFile(ORDERS_FILE, []);
initFile(EMAILS_FILE, []);
initFile(SESSIONS_FILE, {});

// Database Read/Write Helpers
function readJson(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error reading file ${filePath}:`, e);
        return [];
    }
}

function writeJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Error writing file ${filePath}:`, e);
    }
}

// Hash password with SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Session Helpers
function getSessions() {
    return readJson(SESSIONS_FILE);
}

function saveSessions(sessions) {
    writeJson(SESSIONS_FILE, sessions);
}

function getUserByToken(token) {
    if (!token) return null;
    const sessions = getSessions();
    const email = sessions[token];
    if (!email) return null;
    
    const users = readJson(USERS_FILE);
    return users.find(u => u.email === email) || null;
}

// Auth Middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    
    const token = authHeader.split(' ')[1];
    const user = getUserByToken(token);
    
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }
    
    req.user = user;
    next();
}

// Custom MIME Types logic (Express handles most, but we configure GLB explicitly)
express.static.mime.define({
    'model/gltf-binary': ['glb'],
    'model/gltf+json': ['gltf'],
    'text/html': ['htms']
});

// Get Public Configuration
app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

// --- API ENDPOINTS ---

// SignUp API
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const users = readJson(USERS_FILE);
    const lowercaseEmail = email.toLowerCase().trim();
    
    if (users.find(u => u.email === lowercaseEmail)) {
        return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const newUser = {
        name: name.trim(),
        email: lowercaseEmail,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJson(USERS_FILE, users);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessions = getSessions();
    sessions[token] = lowercaseEmail;
    saveSessions(sessions);

    res.status(201).json({
        success: true,
        token,
        user: { name: newUser.name, email: newUser.email }
    });
});

// Login API
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = readJson(USERS_FILE);
    const lowercaseEmail = email.toLowerCase().trim();
    const user = users.find(u => u.email === lowercaseEmail);

    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessions = getSessions();
    sessions[token] = lowercaseEmail;
    saveSessions(sessions);

    res.json({
        success: true,
        token,
        user: { name: user.name, email: user.email }
    });
});

// Note: Google OAuth login removed — customers use email/password only

// Logout API
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sessions = getSessions();
        if (sessions[token]) {
            delete sessions[token];
            saveSessions(sessions);
        }
    }
    res.json({ success: true });
});

// Get User Profile
app.get('/api/auth/me', authenticate, (req, res) => {
    res.json({
        success: true,
        user: { 
            name: req.user.name, 
            email: req.user.email,
            lastAddress: req.user.lastAddress || null
        }
    });
});

// Create Order API (Checkout)
app.post('/api/orders', authenticate, async (req, res) => {
    const { items, shippingDetails } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items list is required and cannot be empty' });
    }
    if (!shippingDetails || !shippingDetails.name || !shippingDetails.phone || !shippingDetails.address || !shippingDetails.city || !shippingDetails.state || !shippingDetails.zip) {
        return res.status(400).json({ error: 'Complete shipping details are required' });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = subtotal > 999 ? 0 : 99;
    const total = subtotal + shippingFee;

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const orderDate = new Date();
    const deliveryDate = new Date();
    deliveryDate.setDate(orderDate.getDate() + 14);

    const newOrder = {
        id: orderId,
        userEmail: req.user.email,
        items,
        shippingDetails,
        subtotal,
        shipping: shippingFee,
        total,
        status: 'Shipped - Arriving in 2 weeks',
        createdAt: orderDate.toISOString(),
        estimatedDeliveryDate: deliveryDate.toISOString()
    };

    // Save order
    const orders = readJson(ORDERS_FILE);
    orders.push(newOrder);
    writeJson(ORDERS_FILE, orders);

    // Save last shipping address to user profile for pre-fill next time
    const users = readJson(USERS_FILE);
    const userIdx = users.findIndex(u => u.email === req.user.email);
    if (userIdx !== -1) {
        users[userIdx].lastAddress = shippingDetails;
        writeJson(USERS_FILE, users);
    }

    const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyhhVC-6zx8lMztUfPdX3cmkmipYhtSUPKGiLMup97akoPjv6qIgDSgtz8f4EzMw3zMiA/exec';

    // ─── EMAIL 1: Admin alert to support@kaavanutrition.in & arjun.subbaraman13@gmail.com ───
    const adminEmailText = `
🛒 NEW KAAVA NUTRITION ORDER PLACED
============================================
Order ID  : ${orderId}
Date/Time : ${orderDate.toLocaleDateString('en-IN')} ${orderDate.toLocaleTimeString('en-IN')}

CUSTOMER:
Name    : ${shippingDetails.name}
Email   : ${req.user.email}
Phone   : ${shippingDetails.phone}
Address : ${shippingDetails.address}, ${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.zip}

ITEMS ORDERED:
${items.map(i => `• ${i.name} × ${i.quantity} = ₹${i.price * i.quantity}`).join('\n')}

Subtotal  : ₹${subtotal}
Shipping  : ${shippingFee === 0 ? 'FREE' : '₹' + shippingFee}
GRAND TOTAL: ₹${total} (Cash on Delivery)

Estimated Delivery: ${deliveryDate.toLocaleDateString('en-IN')} (2 weeks)
============================================
Kaava Order Notification System`;

    let adminEmailStatus = 'pending';
    try {
        const adminParams = new URLSearchParams();
        adminParams.append('name', `Kaava Order Alert [${orderId}]`);
        adminParams.append('email', req.user.email);
        adminParams.append('message', adminEmailText);

        const adminRes = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: adminParams.toString()
        });
        adminEmailStatus = adminRes.ok ? 'sent' : `failed_${adminRes.status}`;
        console.log(`📨 Admin alert email: ${adminEmailStatus} (Order ${orderId})`);
    } catch (err) {
        adminEmailStatus = 'error';
        console.error('❌ Admin email failed:', err.message);
    }

    // ─── EMAIL 2: Customer confirmation to their own inbox ───
    const customerEmailText = `
Hi ${shippingDetails.name},

Thank you for your order from Kaava Nutrition! 🙏

Your order has been confirmed and is being prepared for dispatch.

────────────────────────────────────
ORDER CONFIRMATION
Order ID  : ${orderId}
Date      : ${orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
────────────────────────────────────

ITEMS:
${items.map(i => `• ${i.name} × ${i.quantity}  —  ₹${i.price * i.quantity}`).join('\n')}

Subtotal  : ₹${subtotal}
Shipping  : ${shippingFee === 0 ? 'FREE ✓' : '₹' + shippingFee}
TOTAL PAID: ₹${total} (Cash on Delivery)

DELIVERING TO:
${shippingDetails.name}
${shippingDetails.address}
${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.zip}
Mobile: ${shippingDetails.phone}

📅 EXPECTED DELIVERY: ${deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
(Arrives within 2 weeks)

We will contact you before delivery. Please keep the above amount ready for Cash on Delivery.

For any queries, write to us at support@kaavanutrition.in

With gratitude,
Team Kaava Nutrition
Ancient India. Elite Performance.
www.kaavanutrition.in`;

    let customerEmailStatus = 'pending';
    try {
        // Small delay so both requests don't hit simultaneously
        await new Promise(resolve => setTimeout(resolve, 800));

        const customerParams = new URLSearchParams();
        customerParams.append('name', 'Kaava Nutrition');
        customerParams.append('email', req.user.email); // customer's email as reply-to context
        // Use a unique identifier in the message to direct it to customer
        customerParams.append('message', `CUSTOMER CONFIRMATION — send to ${req.user.email}\n\n${customerEmailText}`);

        const custRes = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: customerParams.toString()
        });
        customerEmailStatus = custRes.ok ? 'sent' : `failed_${custRes.status}`;
        console.log(`📧 Customer confirmation email: ${customerEmailStatus} (${req.user.email})`);
    } catch (err) {
        customerEmailStatus = 'error';
        console.error('❌ Customer email failed:', err.message);
    }

    // Log email activity
    const emailLogs = readJson(EMAILS_FILE);
    emailLogs.push({
        id: `EML-${Date.now().toString().slice(-6)}`,
        orderId,
        adminEmail: { to: 'support@kaavanutrition.in, arjun.subbaraman13@gmail.com', status: adminEmailStatus },
        customerEmail: { to: req.user.email, status: customerEmailStatus },
        sentAt: new Date().toISOString()
    });
    writeJson(EMAILS_FILE, emailLogs);

    res.json({
        success: true,
        orderId,
        order: newOrder,
        emailStatus: { admin: adminEmailStatus, customer: customerEmailStatus }
    });
});

// Get User Order History
app.get('/api/orders', authenticate, (req, res) => {
    const orders = readJson(ORDERS_FILE);
    const userOrders = orders.filter(o => o.userEmail === req.user.email);
    
    // Sort by newest first
    userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        success: true,
        orders: userOrders
    });
});

// Dev Endpoint: Get Simulated Email Logs (for checking emailed orders)
app.get('/api/admin/emails', authenticate, (req, res) => {
    // Only allow admin user or return it for testing during dev
    const emails = readJson(EMAILS_FILE);
    res.json({
        success: true,
        emails: emails.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    });
});

// Serve static website files
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for undefined routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n✅ Server running at http://localhost:${PORT}/index.html`);
    console.log(`   (Press Ctrl+C to stop, keep this running while testing)\n`);
});
