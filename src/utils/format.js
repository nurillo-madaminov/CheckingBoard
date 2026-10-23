// "Sarah Kim" -> "SK" (avatar squares)
export function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function driverLabel(driver) {
  if (!driver) return '';
  return driver.unit ? `${driver.unit} - ${driver.name}` : driver.name;
}
