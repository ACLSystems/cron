//const mongoose = require('mongoose');
const event 	= require('events').EventEmitter;
const log 		= require('./shared/log').log;
const Job 		= require('./src/jobs');
//const Logs 		= require('./src/jobLogs');
var app 			= new event.EventEmitter();
const mainJob = 'MAIN-00';

// Arrancamos la aplicación hasta lograr la conexion a la base de datos
app.on('ready', async function() {
	// Iniciamos la consulta a la base para desplegar los jobs
	try {
		log('info','Localizando job principal...');
		let job = await Job.findOne({code:mainJob,status:'active'});
		if(job) {
			log('info','Job principal');
			console.log(job); //eslint-disable-line
		} else {
			log('info','No se encontró el job principal. Base no configurada. No se ejecutarán jobs');
		}
	} catch(err) {
		log('error','Error al intentar consultar los jobs: ' + err);
	}
});

module.exports = app;

// Private Functions

function today() {
	const now 	= new Date();
	const day 	= now.getDate();
	const month = now.getMonth();
	const wday 	=	now.getDay();
	return([
		{
			day 		: day,
			month 	: month,
			weekDay : wday
		},{
			day 		: '*',
			month 	: month,
			weekDay : wday
		},{
			day 		: day,
			month 	: '*',
			weekDay : wday
		},{
			day 		: day,
			month 	: month,
			weekDay : '*'
		},{
			day 		: '*',
			month 	: '*',
			weekDay : wday
		},{
			day 		: day,
			month 	: '*',
			weekDay : '*'
		},{
			day 		: '*',
			month 	: '*',
			weekDay : '*'
		}
	]);
}
