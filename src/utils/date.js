
const obtenerPeriodicidad = (periodicidad) => {
    switch (periodicidad) {
        case 'SEMANAL':
            return {
                valor: 7,
                unidad: 'day'
            }
        case 'QUINCENAL':
            return {
                valor: 15,
                unidad: 'day'
            }
        case 'MENSUAL':
            return {
                valor: 1,
                unidad: 'month'
            }
        case 'TRIMESTRAL':
            return {
                valor: 3,
                unidad: 'month'
            }
        case 'SEMESTRAL':
            return {
                valor: 6,
                unidad: 'month'
            }
        case 'ANUAL':
            return {
                valor: 1,
                unidad: 'year'
            }
        default:
            break;
    }
}

module.exports = {
    obtenerPeriodicidad
}