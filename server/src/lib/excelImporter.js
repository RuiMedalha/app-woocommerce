const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Leitura simples de um ficheiro Excel através de um caminho local.
// Devolve um array de linhas (como arrays de células).

async function importExcelFromPath(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Ficheiro não encontrado: ${absolutePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);

  const allRows = [];

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values;
      // ExcelJS coloca um elemento vazio no índice 0; removemos
      if (Array.isArray(values)) {
        values.shift();
      }
      allRows.push({
        sheet: worksheet.name,
        rowNumber,
        values,
      });
    });
  });

  return allRows;
}

module.exports = {
  importExcelFromPath,
};

