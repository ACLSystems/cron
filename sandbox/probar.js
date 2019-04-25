const CronJob = require('cron').CronJob;

const jobName = 'miJobChingon';

console.log('Starting cron'); //eslint-disable-line
const job = new CronJob('*/10 * * * * *', function() {
	const d = new Date();
	console.log('Job '+ this.jobName +' runs every 10th second:', d); //eslint-disable-line
	console.log('Next run: ' + this.nextDates(1).map(date => date.toString()));//eslint-disable-line
});
job.jobName = jobName;
job.start();

//console.log(job);//eslint-disable-line
//console.log(job.context);//eslint-disable-line
