
const formatNumber = (num) => {
   return new Intl.NumberFormat('de-DE', { useGrouping: true }).format(num)
}

const formatNumberWithLeadingZeros = (number) => {
    return number.toString().padStart(7, '0');
}

module.exports = {
    formatNumber,
    formatNumberWithLeadingZeros
}