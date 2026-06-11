const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── CORS for kaavanutrition.in ───────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// ─── DATABASE (Upstash Redis via REST) ───────────────────────────────────────
// Env vars auto-injected by Vercel when you add Upstash Redis integration:
// UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
const { Redis } = require('@upstash/redis');
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function getUsers() { return (await redis.get('kaava:users')) || []; }
async function saveUsers(u) { await redis.set('kaava:users', u); }
async function getOrders() { return (await redis.get('kaava:orders')) || []; }
async function saveOrders(o) { await redis.set('kaava:orders', o); }

async function getSession(token) { return await redis.get(`kaava:session:${token}`); }
async function saveSession(token, email) { await redis.set(`kaava:session:${token}`, email, { ex: 60 * 60 * 24 * 30 }); }
async function deleteSession(token) { await redis.del(`kaava:session:${token}`); }


// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const email = await getSession(token);
    if (!email) return res.status(401).json({ error: 'Unauthorized: Invalid session' });

    const users = await getUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Unauthorized: User not found' });

    req.user = user;
    req.sessionToken = token;
    next();
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Public config (exposes Google Client ID to frontend)
app.get('/api/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Google OAuth Login
app.post('/api/auth/google-login', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential token is required' });

    let userEmail, userName, googleId;
    try {
        const ticketRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const payload = await ticketRes.json();

        if (!ticketRes.ok || payload.error) {
            return res.status(400).json({ error: 'Invalid Google token. Please try signing in again.' });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (clientId && payload.aud !== clientId) {
            return res.status(400).json({ error: 'Token audience mismatch.' });
        }

        userEmail = payload.email.toLowerCase().trim();
        userName = payload.name;
        googleId = payload.sub;
    } catch (err) {
        console.error('Google token verify failed:', err);
        return res.status(500).json({ error: 'Failed to verify Google account.' });
    }

    const users = await getUsers();
    let user = users.find(u => u.email === userEmail);

    if (!user) {
        user = {
            name: userName,
            email: userEmail,
            googleId,
            isGoogleUser: true,
            createdAt: new Date().toISOString()
        };
        users.push(user);
        await saveUsers(users);
        console.log(`✅ New customer: ${userEmail}`);
    } else {
        user.name = userName;
        user.googleId = googleId;
        const idx = users.findIndex(u => u.email === userEmail);
        users[idx] = user;
        await saveUsers(users);
    }

    const token = crypto.randomBytes(32).toString('hex');
    await saveSession(token, userEmail);

    res.json({
        success: true,
        token,
        user: { name: user.name, email: user.email, lastAddress: user.lastAddress || null }
    });
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        await deleteSession(authHeader.split(' ')[1]);
    }
    res.json({ success: true });
});

// Get Profile
app.get('/api/auth/me', async (req, res, next) => {
    await authenticate(req, res, async () => {
        res.json({
            success: true,
            user: {
                name: req.user.name,
                email: req.user.email,
                lastAddress: req.user.lastAddress || null
            }
        });
    });
});

// Create Order
app.post('/api/orders', async (req, res, next) => {
    await authenticate(req, res, async () => {
        const { items, shippingDetails } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0)
            return res.status(400).json({ error: 'Items list is required' });
        if (!shippingDetails?.name || !shippingDetails?.phone || !shippingDetails?.address || !shippingDetails?.city || !shippingDetails?.state || !shippingDetails?.zip)
            return res.status(400).json({ error: 'Complete shipping details are required' });

        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const shippingFee = subtotal > 999 ? 0 : 99;
        const total = subtotal + shippingFee;

        const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const orderDate = new Date();
        const deliveryDate = new Date();
        deliveryDate.setDate(orderDate.getDate() + 14);

        const newOrder = {
            id: orderId,
            userEmail: req.user.email,
            items, shippingDetails, subtotal,
            shipping: shippingFee, total,
            status: 'Shipped - Arriving in 2 weeks',
            createdAt: orderDate.toISOString(),
            estimatedDeliveryDate: deliveryDate.toISOString()
        };

        // Save order
        const orders = await getOrders();
        orders.push(newOrder);
        await saveOrders(orders);

        // Save last address to user
        const users = await getUsers();
        const idx = users.findIndex(u => u.email === req.user.email);
        if (idx !== -1) { users[idx].lastAddress = shippingDetails; await saveUsers(users); }

        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbyhhVC-6zx8lMztUfPdX3cmkmipYhtSUPKGiLMup97akoPjv6qIgDSgtz8f4EzMw3zMiA/exec';

        // Admin email
        const adminText = `🛒 NEW ORDER — ${orderId}
============================================
Customer : ${shippingDetails.name} (${req.user.email})
Phone    : ${shippingDetails.phone}
Address  : ${shippingDetails.address}, ${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.zip}

ITEMS:
${items.map(i => `• ${i.name} × ${i.quantity} = ₹${i.price * i.quantity}`).join('\n')}

Subtotal  : ₹${subtotal}
Shipping  : ${shippingFee === 0 ? 'FREE' : '₹' + shippingFee}
TOTAL     : ₹${total} (COD)
Delivery  : ${deliveryDate.toLocaleDateString('en-IN')} (2 weeks)
============================================`;

        let adminStatus = 'pending';
        try {
            const p = new URLSearchParams();
            p.append('name', `Kaava Order [${orderId}]`);
            p.append('email', req.user.email);
            p.append('message', adminText);
            const r = await fetch(appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
            adminStatus = r.ok ? 'sent' : `failed_${r.status}`;
        } catch (e) { adminStatus = 'error'; }

        // Customer email
        const custText = `Hi ${shippingDetails.name},

Thank you for your order from Kaava Nutrition! 🙏

ORDER CONFIRMATION
Order ID  : ${orderId}
Date      : ${orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

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

We will contact you before delivery.
Questions? Email support@kaavanutrition.in

Team Kaava Nutrition
www.kaavanutrition.in`;

        let custStatus = 'pending';
        try {
            await new Promise(r => setTimeout(r, 600));
            const p = new URLSearchParams();
            p.append('name', 'Kaava Nutrition');
            p.append('email', req.user.email);
            p.append('message', `CUSTOMER CONFIRMATION — send to ${req.user.email}\n\n${custText}`);
            const r = await fetch(appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
            custStatus = r.ok ? 'sent' : `failed_${r.status}`;
        } catch (e) { custStatus = 'error'; }

        res.json({
            success: true,
            orderId,
            order: newOrder,
            emailStatus: { admin: adminStatus, customer: custStatus }
        });
    });
});

// Get Order History
app.get('/api/orders', async (req, res) => {
    await authenticate(req, res, async () => {
        const orders = await getOrders();
        const userOrders = orders
            .filter(o => o.userEmail === req.user.email)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, orders: userOrders });
    });
});

module.exports = app;
