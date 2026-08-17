const test = require('node:test');
const assert = require('node:assert/strict');
const { renderizarHtml } = require('../document-renderer/htmlRenderer');
const { generarPdf } = require('../document-renderer/pdfRenderer');

test('genera un PDF estático válido desde la plantilla', async () => {
  const html = await renderizarHtml({
    id: 'F-PDF', fecha: '2026-08-07', moneda: 'CRC', condicionVenta: '01', medioPago: '02',
    emisor: { nombre: 'José Muñoz', identificacion: { tipo: '01', numero: '1' }, correo: 'e@example.com' },
    receptor: { nombre: 'María Peña', identificacion: null, correo: 'r@example.com' },
    items: [{ numeroLinea: 1, detalle: 'Instalación y configuración', cantidad: 1, precioUnitario: 1, descuento: 0, impuesto: { tarifa: 0 }, subtotal: 1, montoTotalLinea: 1 }],
    totales: { totalGravado: 1, totalExento: 0, totalDescuentos: 0, totalImpuesto: 0, totalComprobante: 1 },
  });
  const pdf = await generarPdf(html);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.length > 1000);
  assert.equal(pdf.includes(Buffer.from('/AcroForm')), false);
});
