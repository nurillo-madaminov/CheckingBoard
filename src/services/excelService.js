import * as XLSX from 'xlsx';
import { BOTTOM_TABS } from '../config/statusConfig';

/**
 * EXCEL EXPORT & IMPORT SERVICE
 * Generates dynamic multi-sheet Excel files matching SAFETY_BOARD_dynamic.xlsx format
 */

export function exportToExcel(companies, drivers) {
  const wb = XLSX.utils.book_new();

  // 1. "CHECKING BOARD" sheet (Full overview grouped by company)
  const checkingBoardRows = [
    ['SCHEDULE', 'SIGN', 'STATUS', 'NOTES', 'COMPANY']
  ];

  companies.forEach(company => {
    // Company separator row
    const companyLabel = company.note ? `${company.name} (${company.note})` : company.name;
    checkingBoardRows.push([companyLabel, '', '', '', companyLabel]);

    const compDrivers = drivers.filter(d => d.companyId === company.id);
    compDrivers.forEach(driver => {
      const driverDisplay = driver.unit ? `${driver.unit} - ${driver.name}` : driver.name;
      checkingBoardRows.push([
        driverDisplay,
        driver.sign,
        driver.status,
        driver.notes || '',
        companyLabel
      ]);
    });
  });

  const wsChecking = XLSX.utils.aoa_to_sheet(checkingBoardRows);
  XLSX.utils.book_append_sheet(wb, wsChecking, 'CHECKING BOARD');

  // 2. Category sheets corresponding to bottom tabs
  BOTTOM_TABS.slice(1).forEach(tab => {
    const tabRows = [
      [tab.subtitle || tab.label, '', '', '', ''],
      [`Drivers here: ${drivers.filter(tab.filterFn).length}`, '', '', '', ''],
      ['#', 'DRIVER', 'CURRENT STATUS', 'COMPANY', 'NOTES']
    ];

    let rowNum = 1;
    drivers.filter(tab.filterFn).forEach(driver => {
      const company = companies.find(c => c.id === driver.companyId);
      const companyLabel = company ? (company.note ? `${company.name} (${company.note})` : company.name) : 'Unknown';
      const driverDisplay = driver.unit ? `${driver.unit} - ${driver.name}` : driver.name;

      tabRows.push([
        rowNum++,
        driverDisplay,
        driver.status,
        companyLabel,
        driver.notes || ''
      ]);
    });

    const wsTab = XLSX.utils.aoa_to_sheet(tabRows);
    // Excel sheet name max length is 31 chars and no slashes
    const safeSheetName = tab.label.replace(/\//g, '-').slice(0, 30);
    XLSX.utils.book_append_sheet(wb, wsTab, safeSheetName);
  });

  // Download Excel file
  const fileName = `CHECKING_BOARD_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Import drivers from an uploaded Excel or CSV file
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const importedCompanies = [];
        const importedDrivers = [];
        let currentCompany = null;

        rows.forEach((row, idx) => {
          if (!row || row.length === 0) return;
          const colA = String(row[0] || '').trim();
          const colB = String(row[1] || '').trim();
          const colC = String(row[2] || '').trim();
          const colD = String(row[3] || '').trim();

          // Skip table header
          if (colA.toUpperCase() === 'SCHEDULE' || colA.toUpperCase() === 'DRIVER') return;

          // Check if this row is a company header row
          if (colA && !colB && !colC) {
            let compName = colA;
            let compNote = '';
            const match = colA.match(/^(.*?)\s*\((.*?)\)$/);
            if (match) {
              compName = match[1].trim();
              compNote = match[2].trim();
            }

            currentCompany = {
              id: `comp-${Date.now()}-${importedCompanies.length + 1}`,
              name: compName,
              note: compNote,
              order: importedCompanies.length + 1
            };
            importedCompanies.push(currentCompany);
            return;
          }

          // Otherwise it's a driver row
          if (colA && (colB || colC)) {
            // If no company seen yet, create default
            if (!currentCompany) {
              currentCompany = {
                id: `comp-${Date.now()}-1`,
                name: 'GENERAL FLEET',
                note: '',
                order: 1
              };
              importedCompanies.push(currentCompany);
            }

            // Parse unit number and driver name
            // format could be "122 - MOUZ TEDLA" or "BRUTUS STANLEY 3447" or "1860 LUNAN KEDIAN"
            let unit = '';
            let driverName = colA;

            const dashMatch = colA.match(/^(\d+)\s*-\s*(.+)$/);
            const prefixMatch = colA.match(/^(\d{2,6})\s+(.+)$/);
            const suffixMatch = colA.match(/^(.+?)\s+(\d{2,6})$/);

            if (dashMatch) {
              unit = dashMatch[1];
              driverName = dashMatch[2].trim();
            } else if (prefixMatch) {
              unit = prefixMatch[1];
              driverName = prefixMatch[2].trim();
            } else if (suffixMatch) {
              unit = suffixMatch[2];
              driverName = suffixMatch[1].trim();
            }

            importedDrivers.push({
              id: `drv-${Date.now()}-${importedDrivers.length + 1}`,
              companyId: currentCompany.id,
              unit: unit,
              name: driverName,
              sign: colB.toUpperCase().includes('SIGN') && !colB.toUpperCase().includes('NO') ? 'SIGNED' : 'NO SIGN',
              status: colC || 'READY',
              notes: colD || '',
              highlightColor: ''
            });
          }
        });

        resolve({
          companies: importedCompanies.length > 0 ? importedCompanies : null,
          drivers: importedDrivers
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
