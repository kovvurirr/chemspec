# ⚗️ ChemStruct — Chemical Structure Lookup Tool
### by Aura | ALR Labs

A web application that looks up any chemical compound from PubChem (100M+ compounds)
and draws the 2D molecular structure in the browser.

---

## 🚀 Setup (One Time)

### Requirements
- Node.js (v16 or higher) → https://nodejs.org/
- Internet connection (fetches live data from PubChem)

### Install & Run

```bash
# 1. Extract the zip / open the folder
cd chemstruct

# 2. Install dependencies (one time only)
npm install

# 3. Start the server
npm start
```

### Open in Browser
```
http://localhost:3000
```

---

## 🔬 Features

- **Search by anything**: compound name, CAS number, IUPAC name, trade name
- **100M+ compounds** from PubChem database (live data)
- **2D structure drawn** locally using SmilesDrawer
- **Full properties**: MW, formula, XLogP, TPSA, H-bond donors/acceptors, etc.
- **Light/Dark theme** toggle for structure canvas
- **Download PNG** of the structure
- **Copy SMILES** to clipboard
- Links to PubChem, ChemSpider, DrugBank

## 📁 Files

```
chemstruct/
├── server.js        ← Node.js/Express backend (PubChem proxy)
├── package.json     ← Dependencies
├── README.md        ← This file
└── public/
    └── index.html   ← Frontend application
```

---

## ⚙️ How It Works

```
Browser → localhost:3000 → server.js → PubChem API → back to browser
```

The server acts as a proxy — it fetches data from PubChem on your behalf,
solving the browser CORS restriction. The structure is drawn client-side.

---

Built by Aura for Rama Reddy | ALR Labs / Innoherb Research Labs
