import { ref } from 'vue';

/**
 * Dynamic Row Freshness Utilities
 * Calculates driver line background color based on elapsed time since last check.
 * - Newly checked (0 hours): Fresh Green
 * - Gradually transitions through Lime/Yellow (1-2h), Orange (2.5-3.5h)
 * - Becomes Red at 4+ hours or when never checked.
 */

// Global reactive ticker so that open browser tabs automatically age row colors
// in real-time every 30 seconds without needing user interaction or page reload.
export const currentFreshnessTimestamp = ref(Date.now());

if (typeof window !== 'undefined') {
  setInterval(() => {
    currentFreshnessTimestamp.value = Date.now();
  }, 30000); // Ticks every 30 seconds
}

export function getFreshnessInfo(lastCheckedAt) {
  // Reading the ref registers a reactive dependency in Vue computed properties
  const now = currentFreshnessTimestamp.value;

  if (!lastCheckedAt) {
    // Unchecked -> Immediate Alert Red
    return {
      bgColor: '#FEE2E2', // red-100
      borderColor: '#EF4444', // red-500
      textColor: '#991B1B', // red-800
      badgeBg: '#FCA5A5',
      elapsedHours: 999,
      statusLevel: 'expired',
      label: 'Needs check (>4h)'
    };
  }

  const elapsedMs = now - new Date(lastCheckedAt).getTime();
  const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));

  if (elapsedHours >= 4) {
    return {
      bgColor: '#FEE2E2',
      borderColor: '#EF4444',
      textColor: '#991B1B',
      badgeBg: '#FCA5A5',
      elapsedHours,
      statusLevel: 'expired',
      label: `Checked ${Math.round(elapsedHours)}h ago (Overdue)`
    };
  }

  if (elapsedHours >= 2.5) {
    // 2.5h - 4h: Orange (#FED7AA: 254, 215, 170) -> Red (#FEE2E2: 254, 226, 226)
    const factor = (elapsedHours - 2.5) / 1.5;
    const r = 254;
    const g = Math.round(215 + (226 - 215) * factor);
    const b = Math.round(170 + (226 - 170) * factor);
    return {
      bgColor: `rgb(${r}, ${g}, ${b})`,
      borderColor: '#F97316',
      textColor: '#C2410C',
      badgeBg: '#FDBA74',
      elapsedHours,
      statusLevel: 'warning',
      label: `Checked ${elapsedHours.toFixed(1)}h ago`
    };
  }

  if (elapsedHours >= 1) {
    // 1h - 2.5h: Yellow (#FEF9C3: 254, 249, 195) -> Orange (#FED7AA: 254, 215, 170)
    const factor = (elapsedHours - 1) / 1.5;
    const r = 254;
    const g = Math.round(249 + (215 - 249) * factor);
    const b = Math.round(195 + (170 - 195) * factor);
    return {
      bgColor: `rgb(${r}, ${g}, ${b})`,
      borderColor: '#EAB308',
      textColor: '#A16207',
      badgeBg: '#FDE047',
      elapsedHours,
      statusLevel: 'aging',
      label: `Checked ${elapsedHours.toFixed(1)}h ago`
    };
  }

  // 0 - 1h: Fresh Green (#DCFCE7: 220, 252, 231) -> Yellow (#FEF9C3: 254, 249, 195)
  const factor = elapsedHours / 1;
  const r = Math.round(220 + (254 - 220) * factor);
  const g = Math.round(252 + (249 - 252) * factor);
  const b = Math.round(231 + (195 - 231) * factor);
  const mins = Math.round(elapsedHours * 60);
  return {
    bgColor: `rgb(${r}, ${g}, ${b})`,
    borderColor: '#22C55E',
    textColor: '#15803D',
    badgeBg: '#86EFAC',
    elapsedHours,
    statusLevel: 'fresh',
    label: mins < 1 ? 'Just checked' : `Checked ${mins}m ago`
  };
}
