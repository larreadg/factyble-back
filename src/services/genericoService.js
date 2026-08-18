const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');
const { buscarPorRuc } = require('./padronRucPersistenciaService');
const { consultarCedula } = require('./cedulaService');
const { bloqueaEmision } = require('../utils/sifen/estadoPadronRuc');

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

const getDatosByRuc = async ({ ruc, situacionTributaria } = {}) => {

    try {

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
            const registro = await buscarPorRuc(rucBase);

            if(!registro){
                throw new ErrorApp(`El RUC ${ruc} no existe en el padrón. Verificá el número con el cliente.`, 404);
            }

            // Misma blocklist normalizada que la emisión (bloqueaEmision): buscador y emisión aceptan
            // exactamente los mismos RUCs.
            if(bloqueaEmision(registro.estado)){
                throw new ErrorApp(`El RUC ${ruc} se encuentra en estado "${registro.estado}" y no puede recibir documentos electrónicos`, 400);
            }

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

        // NO_CONTRIBUYENTE / NO_DOMICILIADO (cédula): sin control de estado (el padrón de RUC no aplica),
        // se mantiene el fast-path por cliente cacheado y luego la consulta al registro de cédulas.
        const cliente = await prisma.cliente.findFirst({
            where: {
                AND: [
                    { OR: [{ ruc }, { documento: ruc }] },
                    { situacion_tributaria: situacionTributaria }
                ]
            }
        });

        if(cliente){
            return cliente;
        }

        const data = await consultarCedula(ruc);

        if(!data){
            throw new ErrorApp('No se encontró datos', 404);
        }

        return await prisma.cliente.create({
            data: {
                ruc: data.cedula_identidad,
                documento: data.cedula_identidad,
                razon_social: `${data.apellidos}, ${data.nombres}`,
                situacion_tributaria: situacionTributaria,
                tipo_identificacion: 'CEDULA',
                nombres: data.nombres,
                apellidos: data.apellidos
            }
        });

    } catch (error) {

        ErrorApp.handleServiceError(error, 'Error al obtener datos');

    }

}

module.exports = {
    getDatosByRuc
}