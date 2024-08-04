const cron = require('node-cron');
const { checkFacturaStatus } = require('./facturaService');

const cronJobs = () => {

    cron.schedule('*/10 * * * *', () => {
        checkFacturaStatus();
    });

}

module.exports = cronJobs;