import JSZip from 'jszip';
import { xmlEscape } from './domain.mjs';
export function columnName(index) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
export async function workbook(headers, rows) {
  const zip = new JSZip(),
    xml = (s) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s;
  zip.file(
    '[Content_Types].xml',
    xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
  );
  zip.file(
    '_rels/.rels',
    xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
  );
  zip.file(
    'xl/workbook.xml',
    xml(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="匯出資料" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    xml(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
        headers
          .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="24" customWidth="1"/>`)
          .join('') +
        '</cols><sheetData>' +
        [headers, ...rows]
          .map(
            (row, i) =>
              `<row r="${i + 1}">` +
              row
                .map((cell, j) =>
                  typeof cell === 'number' && Number.isFinite(cell)
                    ? `<c r="${columnName(j)}${i + 1}"><v>${cell}</v></c>`
                    : `<c r="${columnName(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`,
                )
                .join('') +
              '</row>',
          )
          .join('') +
        '</sheetData></worksheet>',
    ),
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export async function exportExcel(name, headers, rows) {
  const data = await workbook(headers, rows),
    url = URL.createObjectURL(
      new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '-') + '.xlsx';
  a.hidden = true;
  // 互動視窗開啟時，視窗以外的元素不可互動；把連結放進最上層的視窗才能觸發下載。
  const dialogs = document.querySelectorAll('dialog[open]');
  const host = dialogs[dialogs.length - 1] || document.body;
  host.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
