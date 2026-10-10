import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Persistent JSON file database (or easily swap to SQLite/PostgreSQL)
const DB_FILE = path.join(__dirname, 'data.json');

// Initial seed data if db does not exist
function readData() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      companies: [
        { id: 'comp-1', name: 'EVO ELD WENZE LLC', note: 'Fleet 1', order: 1 },
        { id: 'comp-2', name: 'AK carrier', note: 'FACTOR', order: 2 },
        { id: 'comp-3', name: 'AK carrier', note: 'LEADER', order: 3 },
        { id: 'comp-4', name: 'UZB TRUCKING', note: '', order: 4 }
      ],
      drivers: [
        { id: 'drv-1', companyId: 'comp-1', unit: '3447', name: 'BRUTUS STANLEY', sign: 'NO SIGN', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-2', companyId: 'comp-1', unit: '1860', name: 'LUNAN KEDIAN', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-3', companyId: 'comp-1', unit: '101', name: 'SARDOR SODIK', sign: 'SIGNED', status: 'AT PU', notes: 'no RC number on profile', highlightColor: '#FEF08A' },
        { id: 'drv-4', companyId: 'comp-1', unit: '102', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-5', companyId: 'comp-1', unit: '103', name: 'THIAM EL HADJI', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-6', companyId: 'comp-1', unit: '104', name: 'KAMOLIDDIN SHARIPOV', sign: 'SIGNED', status: 'AT PU', notes: 'Urgent check', highlightColor: '' },
        { id: 'drv-7', companyId: 'comp-1', unit: '105', name: 'WILLETT JOSEPH RAYKWON BARTLEY', sign: 'SIGNED', status: 'AT DEL', notes: '', highlightColor: '' },
        { id: 'drv-8', companyId: 'comp-1', unit: '106', name: 'ABDUNABIEV JAKHONGIR', sign: 'NO SIGN', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-9', companyId: 'comp-1', unit: '107', name: 'DIENG OUMAR DAOUDA', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-10', companyId: 'comp-1', unit: '108', name: 'JEAN WALKENS', sign: 'SIGNED', status: 'AT PU', notes: 'Checked profile', highlightColor: '' },
        { id: 'drv-11', companyId: 'comp-1', unit: '109', name: 'UROZOLI TAJIBOEV', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-12', companyId: 'comp-1', unit: '110', name: 'ALI KAMAL JAMAL', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-13', companyId: 'comp-1', unit: '111', name: 'RALPH MICHEL', sign: 'SIGNED', status: 'READY', notes: '', highlightColor: '' },
        { id: 'drv-14', companyId: 'comp-1', unit: '112', name: 'NOEL EVENS', sign: 'SIGNED', status: 'COVERED', notes: '', highlightColor: '' },
        { id: 'drv-15', companyId: 'comp-1', unit: '113', name: 'ARTHUR JEAN RONY / AUGUSTE DOULENTZ', sign: 'SIGNED', status: 'GOING DEL', notes: '', highlightColor: '' },
        { id: 'drv-16', companyId: 'comp-2', unit: '122', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'AT PU', notes: '', highlightColor: '' },
        { id: 'drv-17', companyId: 'comp-2', unit: '123', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'AT DEL', notes: 'will leave in 1hour', highlightColor: '' },
        { id: 'drv-18', companyId: 'comp-3', unit: '124', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'GOING DEL', notes: '', highlightColor: '' },
        { id: 'drv-19', companyId: 'comp-3', unit: '125', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'SHOP', notes: 'def issue, will be ready tmrw', highlightColor: '#FED7AA' },
        { id: 'drv-20', companyId: 'comp-4', unit: '126', name: 'MOUZ TEDLA', sign: 'SIGNED', status: 'READY', notes: '', highlightColor: '' }
      ]
    };
    writeData(defaultData);
    return defaultData;
  }
  const content = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(content);
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// REST Endpoints
app.get('/api/state', (req, res) => {
  res.json(readData());
});

app.post('/api/companies', (req, res) => {
  const data = readData();
  const newCompany = {
    id: `comp-${Date.now()}`,
    name: req.body.name,
    note: req.body.note || '',
    order: data.companies.length + 1
  };
  data.companies.push(newCompany);
  writeData(data);
  res.json(newCompany);
});

app.put('/api/companies/:id', (req, res) => {
  const data = readData();
  const idx = data.companies.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    data.companies[idx] = { ...data.companies[idx], ...req.body };
    writeData(data);
    res.json(data.companies[idx]);
  } else {
    res.status(404).send('Company not found');
  }
});

app.delete('/api/companies/:id', (req, res) => {
  const data = readData();
  data.companies = data.companies.filter(c => c.id !== req.params.id);
  data.drivers = data.drivers.filter(d => d.companyId !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/drivers', (req, res) => {
  const data = readData();
  const newDriver = {
    id: `drv-${Date.now()}`,
    companyId: req.body.companyId,
    unit: req.body.unit || '',
    name: req.body.name,
    sign: req.body.sign || 'SIGNED',
    status: req.body.status || 'READY',
    notes: req.body.notes || '',
    highlightColor: req.body.highlightColor || ''
  };
  data.drivers.push(newDriver);
  writeData(data);
  res.json(newDriver);
});

app.put('/api/drivers/:id', (req, res) => {
  const data = readData();
  const idx = data.drivers.findIndex(d => d.id === req.params.id);
  if (idx !== -1) {
    data.drivers[idx] = { ...data.drivers[idx], ...req.body };
    writeData(data);
    res.json(data.drivers[idx]);
  } else {
    res.status(404).send('Driver not found');
  }
});

app.delete('/api/drivers/:id', (req, res) => {
  const data = readData();
  data.drivers = data.drivers.filter(d => d.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`CheckingBoard REST API server running on port ${PORT}`);
});
