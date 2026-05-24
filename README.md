# Scaffold-IQ — Deploy to Vercel

## Project Structure
```
scaffold-iq/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx       ← Full MVP (student + teacher)
│   └── index.js      ← React entry point
├── package.json
├── vercel.json
└── .gitignore
```

## Deploy in 5 Steps

### Step 1 — Create GitHub Repo
1. Go to github.com → New repository
2. Name it `scaffold-iq`
3. Set to Public
4. Click "Create repository"

### Step 2 — Upload Files
In your new repo, upload ALL files from this folder maintaining the same structure:
- Drag and drop the entire folder OR use GitHub Desktop

### Step 3 — Connect to Vercel
1. Go to vercel.com → Sign up free with GitHub
2. Click "Add New Project"
3. Import your `scaffold-iq` GitHub repo
4. Vercel auto-detects Create React App — click Deploy

### Step 4 — Add API Key
1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Add: `REACT_APP_ANTHROPIC_KEY` = your Anthropic API key
3. Redeploy

### Step 5 — Custom Domain (Optional)
1. Vercel gives you: `scaffold-iq.vercel.app` for free
2. If you own scaffold-iq.com → Settings → Domains → Add domain

## Your Live Links
- **Main app**: https://scaffold-iq.vercel.app
- **Student portal**: same link → click "I'm a Student"
- **Teacher dashboard**: same link → click "I'm a Teacher"

## Notes
- All session data saves to browser localStorage (no database needed yet)
- AI calls use Anthropic Claude API (free credits on signup)
- Zero monthly cost on Vercel free tier
