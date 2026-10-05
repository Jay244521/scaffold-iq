# Fort Worth Lead Machine

A React dashboard (Tailwind CSS + lucide-react) of the 20 latest commercial building permits from
the City of Fort Worth's open data permits service. Permits appear as buildings on an isometric site
map, with building height scaled by declared value. Selecting one opens a site dossier: cost, scope,
status, the contractor, a simulated read of which major trades (Electrical, Plumbing, HVAC, Concrete)
the scope doesn't mention, and an editable outreach email draft. The Contractor Book and Manifest
tabs list permits by contractor and by missing trades.

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
├── LeadMachine.jsx   Dashboard (site map, dossier, contractor book, manifest)
├── permitsApi.js     Reads the permit service schema and queries recent commercial permits
└── analyzeNeeds.js   Keyword rules behind the simulated trade analysis
tailwind.config.js
vercel.json           Create React App build settings for Vercel
```

## Deploying
The repo is connected to Vercel, which redeploys on every push to `main`.
