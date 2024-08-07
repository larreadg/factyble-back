
const formatNumber = (num) => {
   return new Intl.NumberFormat('es-ES', { useGrouping: true }).format(num)
}

module.exports = {
    formatNumber
}