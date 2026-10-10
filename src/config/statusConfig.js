/**
 * ==============================================================================
 * CHECKING BOARD - STATUS & COLOR CONFIGURATION FILE
 * ==============================================================================
 * You can easily customize any status name, code, description, or colors here!
 * Simply change the colors (hex format #RRGGBB or Tailwind classes) below.
 * ==============================================================================
 */

export const DRIVER_STATUSES = [
  {
    id: 'AT_PU',
    code: 'AT PU',
    label: 'At Pick Up Location',
    description: 'Driver has arrived at the shipper / pickup facility',
    // Colors: Yellow
    color: '#D97706',           // Text / Accent
    bgColor: '#FEF08A',         // Badge background (light amber/yellow)
    textColor: '#854D0E',       // Badge text
    borderColor: '#EAB308',     // Border
    rowBgColor: '#FEFCE8',      // Soft yellow row background
    activeBgColor: '#FEF08A',   // Active / clicked row highlight
    categoryTab: 'AT_PU_DEL'    // Appears in "AT PU/DEL" tab
  },
  {
    id: 'AT_DEL',
    code: 'AT DEL',
    label: 'At Delivery Location',
    description: 'Driver has arrived at the receiver / delivery facility',
    // Colors: Yellow
    color: '#D97706',
    bgColor: '#FEF9C3',         // Badge background (yellow)
    textColor: '#854D0E',
    borderColor: '#FACC15',
    rowBgColor: '#FEFCE8',      // Soft yellow row background
    activeBgColor: '#FEF08A',   // Active / clicked row highlight
    categoryTab: 'AT_PU_DEL'    // Appears in "AT PU/DEL" tab
  },
  {
    id: 'COVERED',
    code: 'COVERED',
    label: 'Covered / Going to PU',
    description: 'Driver has a load assigned and is heading to pickup',
    // Colors: Darker Yellow / Amber
    color: '#B45309',
    bgColor: '#FDE68A',         // Darker yellow badge
    textColor: '#78350F',
    borderColor: '#F59E0B',
    rowBgColor: '#FFFBEB',      // Soft amber row background
    activeBgColor: '#FDE68A',   // Active / clicked row highlight
    categoryTab: 'COVERED'      // Appears in "COVERED" tab
  },
  {
    id: 'GOING_DEL',
    code: 'GOING DEL',
    label: 'Going to Delivery',
    description: 'Driver loaded and on the road heading to delivery',
    // Colors: Blue
    color: '#2563EB',
    bgColor: '#DBEAFE',         // Light blue badge
    textColor: '#1E40AF',       // Dark blue
    borderColor: '#60A5FA',
    rowBgColor: '#EFF6FF',      // Soft blue row background
    activeBgColor: '#BFDBFE',   // Active / clicked row highlight
    categoryTab: 'GOING_TO_DEL' // Appears in "GOING TO DEL" tab
  },
  {
    id: 'READY',
    code: 'READY',
    label: 'Ready for Load',
    description: 'Driver is empty, available, and ready for load assignment',
    // Colors: Green
    color: '#16A34A',
    bgColor: '#DCFCE7',         // Light green badge
    textColor: '#166534',
    borderColor: '#4ADE80',
    rowBgColor: '#F0FDF4',      // Soft green row background
    activeBgColor: '#BBF7D0',   // Active / clicked row highlight
    categoryTab: 'READY'        // Appears in "READY FOR LOAD" tab
  },
  {
    id: 'SHOP',
    code: 'SHOP',
    label: 'At Repair Shop',
    description: 'Truck is at mechanic or repair facility undergoing service',
    // Colors: Orange
    color: '#EA580C',
    bgColor: '#FFEDD5',         // Light orange badge
    textColor: '#9A3412',
    borderColor: '#FB923C',
    rowBgColor: '#FFF7ED',      // Soft orange row background
    activeBgColor: '#FED7AA',   // Active / clicked row highlight
    categoryTab: 'HOME_INACTIVE'// Appears in "HOME/INACTIVE" tab
  },
  {
    id: 'HOME',
    code: 'HOME',
    label: 'At Home / Rest Off',
    description: 'Driver is taking home time or off duty rest',
    // Colors: Red
    color: '#DC2626',
    bgColor: '#FEE2E2',         // Light red badge
    textColor: '#991B1B',
    borderColor: '#F87171',
    rowBgColor: '#FEF2F2',      // Soft red row background
    activeBgColor: '#FECACA',   // Active / clicked row highlight
    categoryTab: 'HOME_INACTIVE'// Appears in "HOME/INACTIVE" tab
  },
  {
    id: 'INACTIVE',
    code: 'INACTIVE',
    label: 'Inactive / Off Fleet',
    description: 'Driver not currently working or inactive profile',
    // Colors: Light Muted Green / Slate
    color: '#65A30D',
    bgColor: '#ECFCCB',         // Light lime/muted green badge
    textColor: '#3F6212',
    borderColor: '#A3E635',
    rowBgColor: '#F7FEE7',      // Soft lime row background
    activeBgColor: '#D9F99D',   // Active / clicked row highlight
    categoryTab: 'HOME_INACTIVE'// Appears in "HOME/INACTIVE" tab
  }
];

/**
 * SIGN COLUMN VALUES & COLORS
 */
export const SIGN_STATUSES = [
  {
    code: 'SIGNED',
    label: 'SIGNED',
    bgColor: '#D1FAE5',         // Soft emerald green
    textColor: '#065F46',
    borderColor: '#6EE7B7',
    dotColor: '#10B981'
  },
  {
    code: 'NO SIGN',
    altCodes: ['NOT SIGNED'],
    label: 'NO SIGN',
    bgColor: '#FFE4E6',         // Soft rose/red
    textColor: '#9F1239',
    borderColor: '#FDA4AF',
    dotColor: '#F43F5E'
  }
];

/**
 * BOTTOM TABS DEFINITION
 * (Matches the Excel workbook tabs exactly)
 */
export const BOTTOM_TABS = [
  {
    id: 'CHECKING_BOARD',
    label: 'CHECKING BOARD',
    shortLabel: 'All Drivers',
    badgeKey: 'all',
    icon: 'Layers',
    filterFn: () => true // Shows all drivers
  },
  {
    id: 'AT_PU_DEL',
    label: 'AT PU/DEL',
    subtitle: 'AT PICKUP / AT DELIVERY - highest attention',
    shortLabel: 'At PU / Del',
    badgeKey: 'pu_del',
    icon: 'MapPin',
    filterFn: (driver) => ['AT PU', 'AT DEL'].includes(driver.status)
  },
  {
    id: 'READY',
    label: 'READY FOR LOAD',
    subtitle: 'Drivers ready for load assignment',
    shortLabel: 'Ready',
    badgeKey: 'ready',
    icon: 'CheckCircle2',
    filterFn: (driver) => driver.status === 'READY'
  },
  {
    id: 'COVERED',
    label: 'COVERED',
    subtitle: 'COVERED - going to pickup',
    shortLabel: 'Covered',
    badgeKey: 'covered',
    icon: 'Truck',
    filterFn: (driver) => driver.status === 'COVERED'
  },
  {
    id: 'GOING_TO_DEL',
    label: 'GOING TO DEL',
    subtitle: 'Drivers en route to delivery',
    shortLabel: 'Going to Del',
    badgeKey: 'going_del',
    icon: 'Navigation',
    filterFn: (driver) => ['GOING DEL', 'GOING TO DEL'].includes(driver.status)
  },
  {
    id: 'HOME_INACTIVE',
    label: 'HOME/INACTIVE',
    subtitle: 'HOME / REST-OFF / INACTIVE / SHOP',
    shortLabel: 'Home / Inactive',
    badgeKey: 'inactive',
    icon: 'Home',
    filterFn: (driver) => ['HOME', 'INACTIVE', 'SHOP'].includes(driver.status)
  }
];

/**
 * Quick Lookup Helpers
 */
export function getStatusConfig(code) {
  if (!code) return DRIVER_STATUSES[0];
  const normalized = String(code).trim().toUpperCase();
  const match = DRIVER_STATUSES.find(s => s.code.toUpperCase() === normalized || s.id === normalized);
  return match || {
    code: code,
    label: code,
    bgColor: '#F3F4F6',
    textColor: '#374151',
    borderColor: '#D1D5DB'
  };
}

export function getSignConfig(code) {
  if (!code) return SIGN_STATUSES[1]; // default NO SIGN
  const normalized = String(code).trim().toUpperCase();
  const match = SIGN_STATUSES.find(s => 
    s.code.toUpperCase() === normalized || 
    (s.altCodes && s.altCodes.some(a => a.toUpperCase() === normalized))
  );
  return match || SIGN_STATUSES[1];
}
