/**
 * ==============================================================================
 * CHECKING BOARD - STATUSES, SIGN VALUES & SHEET TABS
 * ==============================================================================
 * Each status carries its "look" on the board: background, text color and border,
 * all taken from the design system's steel ramp (see src/assets/industry.css).
 * The busier the status, the darker the fill: AT PU / AT DEL are solid steel,
 * READY is an outline, INACTIVE is dashed.
 * ==============================================================================
 */

export const DRIVER_STATUSES = [
  {
    code: 'AT PU',
    label: 'At Pick Up Location',
    categoryTab: 'AT_PU_DEL',
    look: { background: 'var(--color-accent-700)', color: 'var(--color-bg)', border: '1px solid var(--color-accent-700)' }
  },
  {
    code: 'AT DEL',
    label: 'At Delivery Location',
    categoryTab: 'AT_PU_DEL',
    look: { background: 'var(--color-accent-700)', color: 'var(--color-bg)', border: '1px solid var(--color-accent-700)' }
  },
  {
    code: 'COVERED',
    label: 'Covered / Going to PU',
    categoryTab: 'COVERED',
    look: { background: 'var(--color-accent-300)', color: 'var(--color-accent-900)', border: '1px solid var(--color-accent-300)' }
  },
  {
    code: 'GOING DEL',
    label: 'Going to Delivery',
    categoryTab: 'GOING_TO_DEL',
    look: { background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', border: '1px solid var(--color-accent-400)' }
  },
  {
    code: 'READY',
    label: 'Ready for Load',
    categoryTab: 'READY',
    look: { background: 'transparent', color: 'var(--color-accent-800)', border: '1px solid var(--color-accent-600)' }
  },
  {
    code: 'SHOP',
    label: 'At Repair Shop',
    categoryTab: 'HOME',
    look: { background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)', border: '1px solid var(--color-neutral-300)' }
  },
  {
    code: 'HOME',
    label: 'At Home / Rest Off',
    categoryTab: 'HOME',
    look: { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', border: '1px solid var(--color-neutral-300)' }
  },
  {
    code: 'INACTIVE',
    label: 'Inactive / Off Fleet',
    categoryTab: 'INACTIVE',
    look: { background: 'transparent', color: 'var(--color-neutral-600)', border: '1px dashed var(--color-neutral-400)' }
  }
];

export const SIGN_STATUSES = [
  { code: 'SIGNED', label: 'SIGNED' },
  { code: 'NO SIGN', altCodes: ['NOT SIGNED'], label: 'NO SIGN' }
];

/**
 * SHEET TABS along the bottom of the board
 */
export const BOTTOM_TABS = [
  {
    id: 'CHECKING_BOARD',
    label: 'Checking Board',
    subtitle: 'All active drivers, grouped by carrier',
    filterFn: (driver) => driver.status !== 'INACTIVE' // Inactive drivers hidden from main tab
  },
  {
    id: 'AT_PU_DEL',
    label: 'AT PU/DEL',
    subtitle: 'At pickup / at delivery — highest attention',
    filterFn: (driver) => ['AT PU', 'AT DEL'].includes(driver.status)
  },
  {
    id: 'READY',
    label: 'Ready for Load',
    subtitle: 'Drivers ready for load assignment',
    filterFn: (driver) => driver.status === 'READY'
  },
  {
    id: 'COVERED',
    label: 'Covered',
    subtitle: 'Covered — going to pickup',
    filterFn: (driver) => driver.status === 'COVERED'
  },
  {
    id: 'GOING_TO_DEL',
    label: 'Going to Del',
    subtitle: 'Drivers en route to delivery',
    filterFn: (driver) => ['GOING DEL', 'GOING TO DEL'].includes(driver.status)
  },
  {
    id: 'HOME',
    label: 'Home/Shop',
    subtitle: 'At home / rest-off, or at the repair shop',
    filterFn: (driver) => ['HOME', 'SHOP'].includes(driver.status)
  },
  {
    id: 'INACTIVE',
    label: 'Inactive',
    subtitle: 'Off fleet — hidden from the Checking Board',
    filterFn: (driver) => driver.status === 'INACTIVE'
  }
];

/**
 * Quick Lookup Helpers
 */
export function getStatusConfig(code) {
  if (!code) return DRIVER_STATUSES[0];
  const normalized = String(code).trim().toUpperCase();
  return DRIVER_STATUSES.find(s => s.code === normalized) || {
    code,
    label: code,
    categoryTab: 'CHECKING_BOARD',
    look: { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', border: '1px solid var(--color-neutral-300)' }
  };
}

export function getSignConfig(code) {
  if (!code) return SIGN_STATUSES[1]; // default NO SIGN
  const normalized = String(code).trim().toUpperCase();
  return SIGN_STATUSES.find(s => s.code === normalized || (s.altCodes && s.altCodes.includes(normalized))) || SIGN_STATUSES[1];
}

// Tab a status moves a driver to (for "Moved to ..." toasts)
export function getStatusTab(code) {
  const tabId = getStatusConfig(code).categoryTab;
  return BOTTOM_TABS.find(t => t.id === tabId) || BOTTOM_TABS[0];
}

// Flagged rows: the design replaces the old color palette with a single flag,
// stored in the existing highlight_color column
export const FLAG_COLOR = '#5980a6';
export const isFlagged = (driver) => !!driver.highlightColor;
