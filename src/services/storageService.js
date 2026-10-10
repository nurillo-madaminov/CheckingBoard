/**
 * STORAGE SERVICE FOR CHECKING BOARD
 * Handles persistence via LocalStorage + SQLite backend sync + Excel export/import
 */

const STORAGE_KEY_COMPANIES = 'checkingboard_companies_v1';
const STORAGE_KEY_DRIVERS = 'checkingboard_drivers_v1';

// Seed data based directly on user's SAFETY_BOARD_dynamic.xlsx and context.txt
export const INITIAL_COMPANIES = [
  {
    id: 'comp-1',
    name: 'EVO ELD WENZE LLC',
    note: 'Fleet 1',
    order: 1
  },
  {
    id: 'comp-2',
    name: 'AK carrier',
    note: 'FACTOR',
    order: 2
  },
  {
    id: 'comp-3',
    name: 'AK carrier',
    note: 'LEADER',
    order: 3
  },
  {
    id: 'comp-4',
    name: 'UZB TRUCKING',
    note: '',
    order: 4
  }
];

export const INITIAL_DRIVERS = [
  // EVO ELD WENZE LLC
  {
    id: 'drv-1',
    companyId: 'comp-1',
    unit: '3447',
    name: 'BRUTUS STANLEY',
    sign: 'NO SIGN',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-2',
    companyId: 'comp-1',
    unit: '1860',
    name: 'LUNAN KEDIAN',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-3',
    companyId: 'comp-1',
    unit: '101',
    name: 'SARDOR SODIK',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: 'no RC number on profile',
    highlightColor: '#FEF08A'
  },
  {
    id: 'drv-4',
    companyId: 'comp-1',
    unit: '102',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-5',
    companyId: 'comp-1',
    unit: '103',
    name: 'THIAM EL HADJI',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-6',
    companyId: 'comp-1',
    unit: '104',
    name: 'KAMOLIDDIN SHARIPOV',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: 'Urgent check',
    highlightColor: ''
  },
  {
    id: 'drv-7',
    companyId: 'comp-1',
    unit: '105',
    name: 'WILLETT JOSEPH RAYKWON BARTLEY',
    sign: 'SIGNED',
    status: 'AT DEL',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-8',
    companyId: 'comp-1',
    unit: '106',
    name: 'ABDUNABIEV JAKHONGIR',
    sign: 'NO SIGN',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-9',
    companyId: 'comp-1',
    unit: '107',
    name: 'DIENG OUMAR DAOUDA',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-10',
    companyId: 'comp-1',
    unit: '108',
    name: 'JEAN WALKENS',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: 'Checked profile',
    highlightColor: ''
  },
  {
    id: 'drv-11',
    companyId: 'comp-1',
    unit: '109',
    name: 'UROZOLI TAJIBOEV',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-12',
    companyId: 'comp-1',
    unit: '110',
    name: 'ALI KAMAL JAMAL',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-13',
    companyId: 'comp-1',
    unit: '111',
    name: 'RALPH MICHEL',
    sign: 'SIGNED',
    status: 'READY',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-14',
    companyId: 'comp-1',
    unit: '112',
    name: 'NOEL EVENS',
    sign: 'SIGNED',
    status: 'COVERED',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-15',
    companyId: 'comp-1',
    unit: '113',
    name: 'ARTHUR JEAN RONY / AUGUSTE DOULENTZ',
    sign: 'SIGNED',
    status: 'GOING DEL',
    notes: '',
    highlightColor: ''
  },

  // AK carrier (FACTOR)
  {
    id: 'drv-16',
    companyId: 'comp-2',
    unit: '122',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'AT PU',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-17',
    companyId: 'comp-2',
    unit: '123',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'AT DEL',
    notes: 'will leave in 1hour',
    highlightColor: ''
  },

  // AK carrier (LEADER)
  {
    id: 'drv-18',
    companyId: 'comp-3',
    unit: '124',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'GOING DEL',
    notes: '',
    highlightColor: ''
  },
  {
    id: 'drv-19',
    companyId: 'comp-3',
    unit: '125',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'SHOP',
    notes: 'def issue, will be ready tmrw',
    highlightColor: '#FED7AA'
  },

  // UZB TRUCKING
  {
    id: 'drv-20',
    companyId: 'comp-4',
    unit: '126',
    name: 'MOUZ TEDLA',
    sign: 'SIGNED',
    status: 'READY',
    notes: '',
    highlightColor: ''
  }
];

export function loadCompanies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load companies from localStorage:', e);
  }
  saveCompanies(INITIAL_COMPANIES);
  return INITIAL_COMPANIES;
}

export function saveCompanies(companies) {
  try {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  } catch (e) {
    console.error('Failed to save companies:', e);
  }
}

export function loadDrivers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRIVERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load drivers from localStorage:', e);
  }
  saveDrivers(INITIAL_DRIVERS);
  return INITIAL_DRIVERS;
}

export function saveDrivers(drivers) {
  try {
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(drivers));
  } catch (e) {
    console.error('Failed to save drivers:', e);
  }
}

export function resetToDefaults() {
  saveCompanies(INITIAL_COMPANIES);
  saveDrivers(INITIAL_DRIVERS);
  return {
    companies: [...INITIAL_COMPANIES],
    drivers: [...INITIAL_DRIVERS]
  };
}
