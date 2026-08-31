const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');
const { buscarPorRuc, guardarLote } = require('./padronRucPersistenciaService');
const { consultarRucEnSifen } = require('./sifen/consultaRucService');
const { consultarCedula } = require('./cedulaService');
const { bloqueaEmision } = require('../utils/sifen/estadoPadronRuc');
const { resolverReceptorPorCedula, normalizarDatosCedula } = require('./receptorFallbackService');

// Separa "APELLIDOS, NOMBRES" del padrón sin romper si falta la coma o el segundo segmento
// (la razón social del padrón no siempre trae el formato con coma).
const separarNombre = (razonSocial) => {
    const texto = razonSocial || '';
    if (!texto.includes(',')) {
        return { nombres: texto, apellidos: '' };
    }
    const [apellidosRaw, nombresRaw] = texto.split(',');
    const apellidos = apellidosRaw ? apellidosRaw.trim() : '';
    const nombres = nombresRaw && nombresRaw.trim() !== '' ? nombresRaw.trim() : texto;
    return { nombres, apellidos };
};

const getDatosByRuc = async ({ ruc, situacionTributaria, empresaId } = {}) => {

    try {

        // Documento y situación tributaria efectivamente resueltos. Arrancan como los pedidos y sólo
        // cambian cuando un receptor CONTRIBUYENTE se degrada a cédula por tener el RUC bloqueado en
        // el padrón. `datosCedula` transporta lo ya traído del registro de identificaciones para no
        // consultarlo de nuevo en el camino común de abajo.
        let documento = ruc;
        let situacion = situacionTributaria;
        let datosCedula = null;

        if(situacionTributaria == 'CONTRIBUYENTE'){
            // El padrón es la autoridad y se consulta SIEMPRE (no hay fast-path por cliente cacheado):
            // así el estado se revalida en cada búsqueda con el mismo criterio que la emisión, y no se
            // devuelve un cliente que quedó cacheado como válido pero que hoy está CANCELADO/SUSPENDIDO.
            // El padrón guarda la BASE sin DV ni ceros a la izquierda; el front puede mandar "5050187"
            // o "5050187-4", en ambos casos normalizamos a la BASE.
            const rucBase = String(ruc).split('-')[0].replace(/^0+(?=\d)/, '');

            // Lookup local puro: el fallback externo (ruc.com.py) se eliminó — quedó detrás de un
            // challenge de Cloudflare inaccesible desde servidores. Si el RUC no está en el padrón,
            // el 404 no bloquea la emisión: /factura/simple inserta el RUC en padron_ruc con los
            // datos del receptor que llegan en esa request (ver facturaService).
            let registro = await buscarPorRuc(rucBase);

            // Ver el equivalente en `facturaService`: evita una segunda consulta de red por la misma
            // búsqueda cuando el registro ya vino de SIFEN.
            let registroVerificadoEnSifen = false;

            const adoptarRegistroDeSifen = async (registroSifen) => {
                registro = registroSifen;
                registroVerificadoEnSifen = true;

                try {
                    await guardarLote([registroSifen]);
                } catch (error) {
                    console.log(`[consultaRucSifen] RUC ${rucBase} — no se pudo cachear en padron_ruc: ${error.message}`);
                }
            };

            // Mismo fallback que la emisión (`facturaService`, ver el comentario largo ahí): si el
            // padrón local no conoce el RUC se le pregunta a SIFEN, que es la autoridad real. Sin
            // esto el buscador devolvía un 404 duro para cualquier RUC dado de alta después de la
            // última importación batch del padrón, y el front nunca llegaba a la emisión.
            //
            // El caso "indeterminado" (SIFEN caído/timeout/sin certificado) mantiene el 404, pero con
            // un mensaje distinto: acá no se puede degradar como en la emisión, porque el buscador no
            // recibe una razón social con la que construir el Cliente — la emisión sí, y por eso allá
            // ese caso emite igual.
            if(!registro && empresaId){
                const consultaSifen = await consultarRucEnSifen({ ruc: rucBase, empresaId });

                if(consultaSifen.encontrado){
                    await adoptarRegistroDeSifen(consultaSifen.registro);
                } else if(consultaSifen.indeterminado){
                    throw new ErrorApp(`No se pudo verificar el RUC ${ruc}: no está en el padrón local y SIFEN no respondió la consulta. Reintentá en unos minutos.`, 404);
                }
            }

            if(!registro){
                throw new ErrorApp(`El RUC ${ruc} no existe en el padrón. Verificá el número con el cliente.`, 404);
            }

            // Revalidación contra SIFEN antes de degradar — misma lógica y mismos motivos que en
            // `emitirFactura` (ver el comentario largo ahí). El buscador tiene que correrla también:
            // si no, mostraría al cliente degradado a consumidor final mientras la emisión, que sí
            // revalida, terminaría emitiendo como contribuyente. Los dos caminos deben resolver el
            // mismo receptor.
            if(!registroVerificadoEnSifen && empresaId && bloqueaEmision(registro.estado)){
                const revalidacion = await consultarRucEnSifen({ ruc: rucBase, empresaId });

                if(revalidacion.encontrado){
                    const estadoLocal = registro.estado;
                    await adoptarRegistroDeSifen(revalidacion.registro);

                    if(!bloqueaEmision(registro.estado)){
                        console.log(`[consultaRucSifen] RUC ${rucBase} — el padrón local decía "${estadoLocal}" pero SIFEN responde "${registro.estado}": se devuelve como contribuyente, sin degradar`);
                    }
                }
            }

            // Misma blocklist normalizada que la emisión (bloqueaEmision), y también la misma
            // degradación: si el RUC está bloqueado se resuelve a la persona por su cédula y se
            // devuelve un cliente NO_CONTRIBUYENTE, de modo que el buscador entregue exactamente el
            // receptor con el que emitirFactura va a terminar emitiendo. Si la degradación no aplica
            // (persona jurídica, cédula inexistente, servicio caído) se mantiene el rechazo.
            if(bloqueaEmision(registro.estado)){
                datosCedula = await resolverReceptorPorCedula(rucBase, registro.estado);

                if(!datosCedula){
                    throw new ErrorApp(`El RUC ${ruc} se encuentra en estado "${registro.estado}" y no puede recibir documentos electrónicos`, 400);
                }

                documento = datosCedula.documento;
                situacion = 'NO_CONTRIBUYENTE';
            } else {

                // Formato canónico BASE-DV: es el que exige xmlgen (jsonDteMain parte cliente.ruc por '-'
                // para dRucRec/dDVRec) y el que ya persiste emitirFactura, así ambos flujos coinciden y no
                // se generan clientes duplicados.
                const dv = Number(registro.digitoVerificador);
                const rucCanonico = `${registro.ruc}-${registro.digitoVerificador}`;

                // Reutilizamos un cliente existente tolerando el formato histórico (base sola, sin DV) que
                // guardaba este mismo endpoint antes de unificar el criterio.
                const clienteExistente = await prisma.cliente.findFirst({
                    where: {
                        situacion_tributaria: 'CONTRIBUYENTE',
                        OR: [
                            { ruc: rucCanonico },
                            { documento: rucCanonico },
                            { ruc: registro.ruc },
                            { documento: registro.ruc }
                        ]
                    }
                });

                if(clienteExistente){
                    // Auto-reparación: si la fila quedó en formato legacy (sin DV), la normalizamos a canónico
                    // para que una futura emisión no falle en xmlgen ("RUC debe contener dígito verificador").
                    if(clienteExistente.ruc !== rucCanonico || clienteExistente.documento !== rucCanonico || clienteExistente.dv !== dv){
                        return await prisma.cliente.update({
                            where: { id: clienteExistente.id },
                            data: { ruc: rucCanonico, documento: rucCanonico, dv }
                        });
                    }
                    return clienteExistente;
                }

                const { nombres, apellidos } = separarNombre(registro.razonSocial);

                return await prisma.cliente.create({
                    data: {
                        ruc: rucCanonico,
                        documento: rucCanonico,
                        razon_social: registro.razonSocial,
                        dv,
                        situacion_tributaria: 'CONTRIBUYENTE',
                        tipo_identificacion: 'RUC',
                        nombres,
                        apellidos
                    }
                });

            }
        }

        // NO_CONTRIBUYENTE / NO_DOMICILIADO (cédula): sin control de estado (el padrón de RUC no aplica),
        // se mantiene el fast-path por cliente cacheado y luego la consulta al registro de cédulas.
        // También es el camino de salida del receptor degradado desde un RUC bloqueado, que llega acá
        // con `documento`/`situacion` ya reescritos.
        const cliente = await prisma.cliente.findFirst({
            where: {
                AND: [
                    { OR: [{ ruc: documento }, { documento: documento }] },
                    { situacion_tributaria: situacion }
                ]
            }
        });

        if(cliente){
            return cliente;
        }

        if(!datosCedula){
            datosCedula = normalizarDatosCedula(await consultarCedula(documento));
        }

        if(!datosCedula){
            throw new ErrorApp('No se encontró datos', 404);
        }

        return await prisma.cliente.create({
            data: {
                ruc: datosCedula.documento,
                documento: datosCedula.documento,
                razon_social: datosCedula.razonSocial,
                situacion_tributaria: situacion,
                tipo_identificacion: 'CEDULA',
                nombres: datosCedula.nombres,
                apellidos: datosCedula.apellidos
            }
        });

    } catch (error) {

        ErrorApp.handleServiceError(error, 'Error al obtener datos');

    }

}

module.exports = {
    getDatosByRuc
}