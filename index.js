const cron = require('cron').CronJob;
new cron('*/15 * * * * *', function() {
	console.log('Mi prueba de cron ' + new Date());
}, null, true, '');
