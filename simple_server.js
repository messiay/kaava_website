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

// Google Login Verification API
app.post('/api/auth/google-login', async (req, res) => {
    const { credential, name, email } = req.body;

    let userEmail = '';
    let userName = '';

    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (credential) {
        // Real validation using Google tokeninfo API
        try {
            const ticketResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
            if (!ticketResponse.ok) {
                return res.status(400).json({ error: 'Google login failed: Invalid token' });
            }
            const payload = await ticketResponse.json();

            // Validate audience matches
            if (googleClientId && payload.aud !== googleClientId) {
                return res.status(400).json({ error: 'Google login failed: Audience mismatch' });
            }

            userEmail = payload.email.toLowerCase().trim();
            userName = payload.name;
        } catch (err) {
            console.error('Error verifying Google Token:', err);
            return res.status(500).json({ error: 'Internal server error verifying Google token' });
        }
    } else if (name && email) {
        // Mock login mode is only allowed if GOOGLE_CLIENT_ID is not configured
        if (googleClientId) {
            return res.status(400).json({ error: 'Direct mock login is disabled. Real Google Sign-in is active.' });
        }
        userEmail = email.toLowerCase().trim();
        userName = name.trim();
    } else {
        return res.status(400).json({ error: 'Google credential token or user details are required' });
    }

    const users = readJson(USERS_FILE);
    let user = users.find(u => u.email === userEmail);

    if (!user) {
        user = {
            name: userName,
            email: userEmail,
            passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')), // Secure random password placeholder
            createdAt: new Date().toISOString(),
            isGoogleUser: true
        };
        users.push(user);
        writeJson(USERS_FILE, users);
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessions = getSessions();
    sessions[token] = userEmail;
    saveSessions(sessions);

    res.json({
        success: true,
        token,
        user: { name: user.name, email: user.email }
    });
});

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
        user: { name: req.user.name, email: req.user.email }
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
    const shippingFee = subtotal > 999 ? 0 : 99; // Free shipping over 999
    const total = subtotal + shippingFee;

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    
    // Delivery calculation (Strictly 2 weeks / 14 days)
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

    const orders = readJson(ORDERS_FILE);
    orders.push(newOrder);
    writeJson(ORDERS_FILE, orders);

    // Prepare email HTML
    const emailSubject = `🚨 New Kaava Nutrition Order: ${orderId}`;
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #0b1016; color: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #FDD835; padding-bottom: 15px;">
                <h1 style="color: #FE9D00; margin: 0; font-family: 'Georgia', serif; font-size: 24px;">KAAVA NUTRITION</h1>
                <p style="color: #29B6F6; font-size: 14px; margin: 5px 0 0;">Ancient India. Elite Performance.</p>
            </div>
            
            <h2 style="color: #FDD835; border-bottom: 1px solid #333; padding-bottom: 10px; font-size: 18px;">Order Details: ${orderId}</h2>
            <p style="font-size: 14px; color: #a0b0c0;"><strong>Order Date:</strong> ${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString()}</p>
            
            <h3 style="color: #29B6F6; margin-top: 20px; font-size: 16px;">Customer Information</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #a0b0c0;">
                <tr><td style="padding: 5px 0;"><strong>Name:</strong></td><td>${shippingDetails.name}</td></tr>
                <tr><td style="padding: 5px 0;"><strong>Email:</strong></td><td>${req.user.email}</td></tr>
                <tr><td style="padding: 5px 0;"><strong>Phone:</strong></td><td>${shippingDetails.phone}</td></tr>
                <tr><td style="padding: 5px 0; vertical-align: top;"><strong>Address:</strong></td><td>${shippingDetails.address}, ${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.zip}</td></tr>
            </table>

            <h3 style="color: #29B6F6; margin-top: 25px; font-size: 16px;">Items Ordered</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #ffffff; margin-bottom: 15px;">
                <thead>
                    <tr style="border-bottom: 1px solid #333; color: #a0b0c0;">
                        <th style="text-align: left; padding: 8px 0;">Product</th>
                        <th style="text-align: center; padding: 8px 0;">Qty</th>
                        <th style="text-align: right; padding: 8px 0;">Price</th>
                        <th style="text-align: right; padding: 8px 0;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr style="border-bottom: 1px dotted #333;">
                            <td style="padding: 10px 0;">${item.name}</td>
                            <td style="text-align: center; padding: 10px 0;">${item.quantity}</td>
                            <td style="text-align: right; padding: 10px 0;">₹${item.price}</td>
                            <td style="text-align: right; padding: 10px 0;">₹${item.price * item.quantity}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="2"></td>
                        <td style="text-align: right; padding: 15px 0 5px; color: #a0b0c0;"><strong>Subtotal:</strong></td>
                        <td style="text-align: right; padding: 15px 0 5px;">₹${subtotal}</td>
                    </tr>
                    <tr>
                        <td colspan="2"></td>
                        <td style="text-align: right; padding: 5px 0; color: #a0b0c0;"><strong>Shipping:</strong></td>
                        <td style="text-align: right; padding: 5px 0;">${shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}</td>
                    </tr>
                    <tr style="font-size: 16px; color: #FDD835;">
                        <td colspan="2"></td>
                        <td style="text-align: right; padding: 10px 0; border-top: 2px solid #FDD835;"><strong>Total Paid:</strong></td>
                        <td style="text-align: right; padding: 10px 0; border-top: 2px solid #FDD835;"><strong>₹${total}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div style="border-top: 1px solid #333; padding-top: 15px; margin-top: 20px; text-align: center; font-size: 13px; color: #81C784;">
                <p><strong>Estimated Delivery:</strong> ${deliveryDate.toLocaleDateString()} (Arrives in 2 weeks)</p>
            </div>
        </div>
    `;

    // Send email alert via Google Apps Script (same as contact form)
    const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyhhVC-6zx8lMztUfPdX3cmkmipYhtSUPKGiLMup97akoPjv6qIgDSgtz8f4EzMw3zMiA/exec';
    const textEmailMessage = `
🛒 NEW KAAVA NUTRITION ORDER PLACED
--------------------------------------------------
Order ID: ${orderId}
Order Date: ${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString()}

CUSTOMER INFO:
Name: ${shippingDetails.name}
Email: ${req.user.email}
Phone: ${shippingDetails.phone}
Shipping Address:
${shippingDetails.address}
${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.zip}

ITEMS ORDERED:
${items.map(item => `• ${item.name} (Qty: ${item.quantity}) - ₹${item.price} each (Subtotal: ₹${item.price * item.quantity})`).join('\n')}

TOTAL SUMMARY:
Subtotal: ₹${subtotal}
Shipping: ${shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
Grand Total Paid: ₹${total} (Cash on Delivery)

Estimated Delivery Date: ${deliveryDate.toLocaleDateString()} (Arrives in 2 weeks)
--------------------------------------------------
`;

    let emailStatus = 'simulated';

    // Trigger Apps Script
    try {
        const bodyParams = new URLSearchParams();
        bodyParams.append('name', `Kaava Order System [${orderId}]`);
        bodyParams.append('email', req.user.email);
        bodyParams.append('message', textEmailMessage);

        const appsScriptRes = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyParams.toString()
        });
        
        if (appsScriptRes.ok) {
            emailStatus = 'sent_via_script';
            console.log(`✅ Google Apps Script order email notification sent successfully for ${orderId}`);
        } else {
            console.warn(`⚠️ Google Apps Script returned status ${appsScriptRes.status} for ${orderId}`);
        }
    } catch (scriptError) {
        console.error('❌ Failed to trigger Google Apps Script email notifier:', scriptError);
    }

    // Try sending real email via SMTP if configured as fallback/secondary
    const emailLogs = readJson(EMAILS_FILE);
    const mailOptions = {
        from: process.env.SMTP_FROM || '"Kaava Nutrition Alerts" <alerts@kaavanutrition.in>',
        to: process.env.ADMIN_EMAIL || 'admin@kaavanutrition.in',
        subject: emailSubject,
        html: emailHtml
    };

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail(mailOptions);
            emailStatus = emailStatus === 'sent_via_script' ? 'sent_both' : 'sent_via_smtp';
            console.log(`✅ SMTP admin email sent for order ${orderId}`);
        } catch (mailError) {
            console.error('❌ Failed to send SMTP email:', mailError);
        }
    }

    // Save to simulated inbox log so that user can preview it locally in their browser
    emailLogs.push({
        id: `EML-${Date.now().toString().slice(-6)}`,
        orderId,
        to: 'support@kaavanutrition.in, arjun.subbaraman13@gmail.com',
        subject: emailSubject,
        html: emailHtml,
        textMessage: textEmailMessage,
        sentAt: new Date().toISOString(),
        status: emailStatus
    });
    writeJson(EMAILS_FILE, emailLogs);

    res.json({
        success: true,
        orderId,
        order: newOrder
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
