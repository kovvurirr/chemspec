const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PROXY: Resolve name/CAS → CID
app.get('/api/resolve', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/cids/JSON`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: `"${q}" not found in PubChem` });
    const d = await r.json();
    const cids = d.IdentifierList?.CID;
    if (!cids?.length) return res.status(404).json({ error: `"${q}" not found` });
    res.json({ cid: cids[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROXY: Get SMILES for a CID
app.get('/api/smiles/:cid', async (req, res) => {
  const { cid } = req.params;
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IsomericSMILES,CanonicalSMILES/JSON`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: 'SMILES not found' });
    const d = await r.json();
    const p = d.PropertyTable?.Properties?.[0];
    res.json({ smiles: p?.IsomericSMILES || p?.CanonicalSMILES || '' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROXY: Get all properties
app.get('/api/props/:cid', async (req, res) => {
  const { cid } = req.params;
  try {
    const fields = 'IUPACName,MolecularFormula,MolecularWeight,IsomericSMILES,CanonicalSMILES,InChIKey,XLogP,ExactMass,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount,Complexity';
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${fields}/JSON`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ error: 'Properties not found' });
    const d = await r.json();
    const p = d.PropertyTable?.Properties?.[0] || {};
    res.json({
      iupac:      p.IUPACName,
      formula:    p.MolecularFormula,
      mw:         p.MolecularWeight,
      smiles:     p.IsomericSMILES || p.CanonicalSMILES,
      inchikey:   p.InChIKey,
      xlogp:      p.XLogP,
      exactMass:  p.ExactMass,
      tpsa:       p.TPSA,
      hbd:        p.HBondDonorCount,
      hba:        p.HBondAcceptorCount,
      rotBonds:   p.RotatableBondCount,
      heavyAtoms: p.HeavyAtomCount,
      complexity: p.Complexity,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROXY: Get synonyms
app.get('/api/synonyms/:cid', async (req, res) => {
  const { cid } = req.params;
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`;
    const r = await fetch(url);
    if (!r.ok) return res.json({ cas: null, names: [], primary: '' });
    const d = await r.json();
    const all = d.InformationList?.Information?.[0]?.Synonym || [];
    const cas   = all.find(s => /^\d{1,7}-\d{2}-\d$/.test(s)) || null;
    const names = all.filter(s => s.length < 50 && !/^\d/.test(s) && !/^DTXSID|^CHEBI|^CHEMBL|^InChI|^UNII/.test(s)).slice(0, 10);
    res.json({ cas, primary: all[0] || '', names });
  } catch(e) {
    res.json({ cas: null, names: [], primary: '' });
  }
});

// ── PROXY: Get description
app.get('/api/description/:cid', async (req, res) => {
  const { cid } = req.params;
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`;
    const r = await fetch(url);
    if (!r.ok) return res.json({ description: '' });
    const d = await r.json();
    const infos = d.InformationList?.Information || [];
    let desc = '';
    for (const info of infos) {
      if (info.Description && info.Description.length > 30) {
        desc = info.Description.slice(0, 400);
        break;
      }
    }
    res.json({ description: desc });
  } catch(e) {
    res.json({ description: '' });
  }
});

// ── COMBINED: full lookup in one call
app.get('/api/lookup', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    // Step 1: resolve CID
    const resolveUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/cids/JSON`;
    const rr = await fetch(resolveUrl);
    if (!rr.ok) return res.status(404).json({ error: `"${q}" not found in PubChem database` });
    const rd = await rr.json();
    const cid = rd.IdentifierList?.CID?.[0];
    if (!cid) return res.status(404).json({ error: `"${q}" not found` });

    // Step 2: fetch props + synonyms + description in parallel
    const fields = 'IUPACName,MolecularFormula,MolecularWeight,IsomericSMILES,CanonicalSMILES,InChIKey,XLogP,ExactMass,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount,Complexity';
    const [propsRes, synsRes, descRes] = await Promise.all([
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${fields}/JSON`),
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`),
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`),
    ]);

    const propsData = await propsRes.json();
    const p = propsData.PropertyTable?.Properties?.[0] || {};
    const smiles = p.IsomericSMILES || p.CanonicalSMILES || '';

    // Synonyms
    const synsData = await synsRes.json();
    const allSyns = synsData.InformationList?.Information?.[0]?.Synonym || [];
    const cas   = allSyns.find(s => /^\d{1,7}-\d{2}-\d$/.test(s)) || null;
    const names = allSyns.filter(s => s.length < 50 && !/^\d/.test(s) && !/^DTXSID|^CHEBI|^CHEMBL|^InChI|^UNII/.test(s)).slice(0, 10);
    const primaryName = allSyns[0] || p.IUPACName || q;

    // Description
    let description = '';
    const descData = await descRes.json();
    for (const info of (descData.InformationList?.Information || [])) {
      if (info.Description?.length > 30) { description = info.Description.slice(0, 500); break; }
    }

    res.json({
      cid,
      name: primaryName,
      iupac:      p.IUPACName || '',
      formula:    p.MolecularFormula || '',
      mw:         p.MolecularWeight || '',
      smiles,
      inchikey:   p.InChIKey || '',
      xlogp:      p.XLogP ?? null,
      exactMass:  p.ExactMass ?? null,
      tpsa:       p.TPSA ?? null,
      hbd:        p.HBondDonorCount ?? null,
      hba:        p.HBondAcceptorCount ?? null,
      rotBonds:   p.RotatableBondCount ?? null,
      heavyAtoms: p.HeavyAtomCount ?? null,
      complexity: p.Complexity ?? null,
      cas,
      names,
      description,
    });
  } catch(e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ⚗️  ChemStruct server running at http://localhost:${PORT}\n`);
});
