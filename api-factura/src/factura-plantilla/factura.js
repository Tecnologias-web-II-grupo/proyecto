document.addEventListener("DOMContentLoaded", cargarFactura);

async function cargarFactura() {

    try {

        // Obtiene los datos del archivo JSON y 
        const respuesta = await fetch("/factura-ejemplo.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar la factura");
        }

        const factura = await respuesta.json();

        // =========================
        // INFORMACIÓN GENERAL
        // =========================

        document.getElementById("facturaId").textContent =
            factura.id;

        document.getElementById("fechaFactura").textContent =
            formatearFecha(factura.fecha);

        document.getElementById("moneda").textContent =
            factura.moneda;

        document.getElementById("condicionVenta").textContent =
            factura.condicionVenta;

        document.getElementById("medioPago").textContent =
            factura.medioPago;


        // =========================
        // EMISOR
        // =========================

        document.getElementById("emisorNombre").textContent =
            factura.emisor.nombre;

        document.getElementById("emisorNombreDetalle").textContent =
            factura.emisor.nombre;

        document.getElementById("emisorTipo").textContent =
            factura.emisor.identificacion.tipo;

        document.getElementById("emisorNumero").textContent =
            factura.emisor.identificacion.numero;

        document.getElementById("emisorNumeroDetalle").textContent =
            factura.emisor.identificacion.numero;

        document.getElementById("emisorCorreo").textContent =
            factura.emisor.correo;

        document.getElementById("emisorCorreoDetalle").textContent =
            factura.emisor.correo;


        // =========================
        // RECEPTOR
        // =========================

        document.getElementById("receptorNombre").textContent =
            factura.receptor.nombre;

        document.getElementById("receptorCorreo").textContent =
            factura.receptor.correo;


        // La identificación del receptor puede ser opcional
        if (factura.receptor.identificacion) {

            document.getElementById("receptorTipo").textContent =
                factura.receptor.identificacion.tipo;

            document.getElementById("receptorNumero").textContent =
                factura.receptor.identificacion.numero;

        } else {

            document.getElementById("receptorTipo").textContent =
                "No indicada";

            document.getElementById("receptorNumero").textContent =
                "No indicada";
        }


        // =========================
        // PRODUCTOS / SERVICIOS
        // =========================

        cargarItems(factura.items, factura.moneda);


        // =========================
        // TOTALES
        // =========================

        document.getElementById("totalGravado").textContent =
            formatoMoneda(factura.totales.totalGravado, factura.moneda);

        document.getElementById("totalExento").textContent =
            formatoMoneda(factura.totales.totalExento, factura.moneda);

        document.getElementById("totalDescuentos").textContent =
            formatoMoneda(factura.totales.totalDescuentos, factura.moneda);

        document.getElementById("totalImpuesto").textContent =
            formatoMoneda(factura.totales.totalImpuesto, factura.moneda);

        document.getElementById("totalComprobante").textContent =
            formatoMoneda(factura.totales.totalComprobante, factura.moneda);


    } catch (error) {

        console.error("Error al cargar la factura:", error);

        mostrarError();

    }
}


// =====================================
// CARGAR LOS ITEMS DE LA FACTURA
// =====================================

function cargarItems(items, moneda) {

    const tabla = document.getElementById("itemsFactura");

    // Limpia el contenido de ejemplo
    tabla.innerHTML = "";


    items.forEach(item => {

        const fila = document.createElement("tr");

        fila.innerHTML = `

            <td>
                ${item.numeroLinea ?? ""}
            </td>

            <td>
                ${item.detalle}
            </td>

            <td>
                ${item.cantidad}
            </td>

            <td>
                ${formatoMoneda(item.precioUnitario, moneda)}
            </td>

            <td>
                ${formatoMoneda(item.descuento, moneda)}
            </td>

            <td>
                ${item.impuesto.tarifa}%
            </td>

            <td>
                ${formatoMoneda(item.subtotal, moneda)}
            </td>

            <td>
                ${formatoMoneda(item.montoTotalLinea, moneda)}
            </td>

        `;

        tabla.appendChild(fila);

    });
}


// =====================================
// FORMATO DE MONEDA
// =====================================

function formatoMoneda(valor, moneda) {

    const simbolo = moneda === "USD" ? "$" : "₡";

    return simbolo + Number(valor).toLocaleString("es-CR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// =====================================
// FORMATO DE FECHA
// =====================================

function formatearFecha(fecha) {

    const fechaObjeto = new Date(fecha);

    return fechaObjeto.toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}


// =====================================
// MOSTRAR ERROR
// =====================================

function mostrarError() {

    const factura = document.querySelector(".factura");

    factura.innerHTML = `

        <div style="
            text-align: center;
            padding: 60px 20px;
        ">

            <h2>
                No se pudo cargar la factura
            </h2>

            <p style="margin-top: 10px;">
                Verifique que el archivo factura-ejemplo.json
                esté disponible.
            </p>

        </div>

    `;
}