# ⚡ EcomSpark — AI Ecommerce Research Platform

A complete AI-powered ecommerce research SaaS tool. Built with pure HTML, CSS, and JavaScript. No backend required — deploys to Netlify or Vercel in minutes.

## 🚀 Quick Deploy to Netlify

1. **Fork/Upload** this folder to your GitHub repository
2. Go to [netlify.com](https://netlify.com) → New Site → Import from GitHub
3. Select your repo → Deploy (no build settings needed)
4. Your live URL will be: `https://your-site.netlify.app`
5. **Admin panel**: `https://your-site.netlify.app/admin`

## 🔑 Admin Login

Default password: `ecomspark_admin_2025`

**To change password:**
1. Go to `/admin`
2. Login with default password
3. Go to Settings → Change Admin Password

## ⚙️ Setup (First Time)

### 1. Connect Your Anthropic API Key
- Click **⚙️ API Key** in the header
- Get your key from [console.anthropic.com](https://console.anthropic.com)
- Paste it in (starts with `sk-ant-...`)
- Your key is stored locally in the browser — never on any server

### 2. Add Winning Products (Admin)
- Go to `/admin` → Login
- Click **🏆 Winning Products** → **+ Add Product**
- Fill in all product details, ad strategies, captions
- Mark as "Premium Only" to lock for free users

### 3. Customize Banners (Admin)
- Go to `/admin` → **🖼️ Banners**
- Edit or add homepage banners
- Control title, subtitle, CTA button, background color

## 📁 File Structure

```
ecomspark/
├── index.html          ← Main homepage (all tools + winning products)
├── help.html           ← Support & upgrade page
├── netlify.toml        ← Netlify routing config
├── vercel.json         ← Vercel routing config
├── admin/
│   └── index.html      ← Admin panel (password protected)
└── assets/
    ├── css/
    │   └── style.css   ← Complete design system
    └── js/
        └── app.js      ← All logic, AI calls, storage
```

## 🛠️ Features

### For Users (Homepage)
- 🏆 **Winning Products** — Admin-curated products with full ad strategies
- 🔬 **Product Research** — AI demand/competition scoring
- 🎵 **TikTok Viral Finder** — Detect trending niches
- 🎨 **Ad Creative Generator** — TikTok + Facebook ads
- 🎬 **Ad Script Generator** — Full UGC scripts
- ✍️ **Product Description** — SEO-optimized copy
- 🏭 **Supplier Finder** — Alibaba/AliExpress strategy + outreach email
- 🔍 **SEO Toolkit** — Keywords, title optimizer, meta description
- 🔭 **Competitor Analysis** — Market gaps & win strategy
- 🕵️ **Fake Review Detector** — Authenticity scoring
- 📊 **Market Research Report** — Full AI market reports
- 💬 **Live Support Chat** — Floating chat button → messages saved to admin

### For Admin
- 📊 Dashboard with stats
- 🏆 Product management (add/edit/delete winning products with full details)
- 🖼️ Banner management (homepage banners)
- 🆘 Help requests management (view, reply, close)
- 🚀 Upgrade inquiries (activate Pro users directly)
- 👥 Pro user management
- 📈 Analytics (tool usage, events)
- ⚙️ Settings (password, toggles)
- ⬇️ Export CSV for help/agency data

## 💳 Pricing Tiers

| Feature | Free | Pro ($29/mo) | Agency ($99/mo) |
|---------|------|------|------|
| AI Tools | 3/day | Unlimited | Unlimited |
| Winning Products | Public only | All products | All products |
| Ad Strategies | Locked | Unlocked | Unlocked |
| Team Seats | 1 | 1 | 5 |

## 🔐 Security Notes

- Admin password stored in localStorage (change after deploy)
- API key stored in user's browser only
- No external database — all data in localStorage
- Suitable for personal/small team use

## 🔄 How Data Works

All data is stored in **browser localStorage**:
- Help requests from users → visible in admin panel
- Products added by admin → shown on homepage
- Banners configured by admin → shown in homepage slider
- Usage tracking for analytics

> ⚠️ Since this uses localStorage, data is per-browser. For multi-device admin management, all team members must use the same browser/device, OR upgrade to a version with a backend database.

## 🆙 Upgrade Path (Future)

To add a real backend:
1. Replace `Store.*` calls in `app.js` with API calls
2. Add a Node.js/Supabase/Firebase backend
3. Implement real user authentication with JWT
4. Add payment integration (Stripe)

---

Built with ❤️ using Claude AI by Anthropic
