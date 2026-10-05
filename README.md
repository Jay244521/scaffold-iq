# Fort Worth Lead Machine

A React dashboard (Tailwind CSS + lucide-react) of the 20 latest commercial building permits from
the City of Fort Worth's ArcGIS development permits feed. Each permit card shows the address,
declared value and contractor, and an **Analyze Needs** button gives a simulated read of which major
trades (Electrical, Plumbing, HVAC, Concrete) the project likely needs but the scope doesn't mention.

## Run locally
```bash
npm install
npm start
```
Then open http://localhost:3000.

## Project structure
```
public/index.html
src/
├── index.js          React entry point
├── index.css         Tailwind directives
├── LeadMachine.jsx   Dashboard (fetching, stats, grid, cards)
└── analyzeNeeds.js   Keyword rules behind the simulated trade analysis
tailwind.config.js
vercel.json           Create React App build settings for Vercel
```

## Deploying
The repo is connected to Vercel, which redeploys on every push to `main`.
