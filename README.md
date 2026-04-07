# ⚡ EcomSpark v6.0 — Firebase Edition

## 📁 File Structure
```
ecomspark/
├── index.html           ← User Homepage
├── help.html            ← Support page
├── netlify.toml         ← Netlify config
├── vercel.json          ← Vercel config
├── firestore.rules      ← Firebase rules (copy to Firebase console)
├── admin/
│   └── index.html       ← Admin Panel
└── assets/
    ├── css/style.css
    └── js/app.js
```

## 🚀 Deploy করার ধাপ

### ধাপ ১: Firebase Console Setup
1. console.firebase.google.com এ যান
2. আপনার project ecomspark-cd4ea select করুন

### ধাপ ২: Authentication চালু করুন
1. বাঁ দিকে "Authentication" click করুন
2. "Get started" click করুন
3. "Email/Password" click করুন
4. "Enable" toggle ON করুন → "Save"

### ধাপ ৩: Firestore Database তৈরি করুন
1. বাঁ দিকে "Firestore Database" click করুন
2. "Create database" click করুন
3. "Start in test mode" select করুন → Next → Done

### ধাপ ৪: Firestore Rules সেট করুন
1. Firestore এ "Rules" tab click করুন
2. এই file এর "firestore.rules" এর সব text copy করুন
3. Rules editor এ paste করুন → "Publish" click করুন

### ধাপ ৫: Admin Account তৈরি করুন
1. Authentication → Users → "Add user" click করুন
2. admin@youremail.com ও একটি strong password দিন → Add
3. নতুন user এর UID copy করুন (right side এ দেখাবে)

### ধাপ ৬: Admin Firestore Document তৈরি করুন
1. Firestore → "Start collection" → Collection ID: "users" → Next
2. Document ID: উপরের UID paste করুন
3. Fields add করুন:
   - uid (string): same UID
   - name (string): Admin
   - email (string): আপনার admin email
   - plan (string): admin
   - isPro (boolean): true
   - banned (boolean): false
   - createdAt (string): 2025-01-01T00:00:00.000Z
4. "Save" click করুন

### ধাপ ৭: Netlify Deploy
1. netlify.com এ যান → "Add new site" → "Deploy manually"
2. এই ecomspark folder টা drag & drop করুন
3. Deploy হবে → আপনার URL পাবেন

### ধাপ ৮: Admin এ Login
1. your-site.netlify.app/admin এ যান
2. ধাপ ৫ এর email ও password দিয়ে login করুন

### ধাপ ৯: Gemini API Key সেট করুন
1. Admin Panel → System API Key page এ যান
2. aistudio.google.com/apikey থেকে free key নিন
3. Key paste করুন → Save করুন
