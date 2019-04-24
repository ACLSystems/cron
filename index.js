const tz 								= 'America/Mexico_City';
const mongoose 					= require( 'mongoose' );
const uriFormat 				= require( 'mongodb-uri' );
const version						= require('./version/version');
const logger 						= require('./shared/winston-logger');
mongoose.Promise = global.Promise;

log('info', version.app + '@' + version.version + ' ' + version.vendor + '\u00A9' + version.year);

// DEFINICION DE JOBS
const permJob 					= require('cron').CronJob; // JOB Permanente. NO BORRAR
const groupMaintenance 	= require('cron').CronJob; // JOB para mantenimiento de grupos que han cerrado

// PROGRAMACION DE JOBS
// Colocar la programación aquí o preferentemente definir una variable de ambiente
const permJobSchedule		= '0 0 6 * * *'; // Todos los días a las 06:00 hrs
const groupMainSchedule	= process.env.JOBGROUPMAIN || '*/10 * * * * *';

// Colocar los nombres de los jobs en el arreglo
const JOBS = [permJobSchedule,groupMainSchedule];

// CONEXION COMUN A MONGO
const dbURI 							= process.env.MONGO_URI || 'mongodb://operator:Password01@mongo:27017/alumno';

// Creamos la conexión a la base y queda disponible para cualquier job que la quiera usar
const options = {
	autoReconnect: true,
	reconnectTries: 2,
	reconnectInterval: 1000,
	poolSize: 10,
	useNewUrlParser: true
};
mongoose.connect(encodeMongoURI(dbURI), options);
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);

// EVENTOS DE CONEXION
// Cuando nos logremos conectar
mongoose.connection.on('connected', function () {
	let now = new Date();
	log('info','Conexion a la base de datos abierta exitosamente. ' + now);
	log('info',JOBS.length + ' jobs listos para correr en la programacion definida');
});

// Si la conexión manda un error
mongoose.connection.on('error',function (err) {
	let now = new Date();
	log('error','Error de conexion a la base de datos: ' + err + ' ' + now);
});

// Cuando la conexión a la base se pierde
mongoose.connection.on('disconnected', function () {
	let now = new Date();
	log('warn','Se perdio la conexion a la base. ' + now);
});

// Si el proceso de NodeJS termina
process.on('SIGINT', function() {
	mongoose.connection.close(function () {
		let now = new Date();
		log('info','El servicio y la conexion a la base han sido terminados exitosamente. ' + now);
		process.exit(0);
	});
});

// JOBS

// Job Permanente
// Este job se puede usar para actividades cotidianas de servidor...
new permJob(permJobSchedule, function() {
	const jobName = 'permJob';
	const now = new Date();
	log('info','Iniciando corrida de Job ' + jobName + '. ' + now);
	// ----------------- RUNNING ACTIVITIES
	let finished = new Date();
	let dif = finished - now;
	let calc = calculateMilis(dif);
	log('info','El Job ' + jobName + ' ha terminado. ' + finished);
	log('info','El tiempo de corrida del job ' + jobName + ' fue de ' + calc.number + ' ' + calc.units);
}, null, true, tz);

// Job para mantenimiento de grupos
new groupMaintenance(groupMainSchedule, async function() {
	const Group 	= require('./src/groups');
	const Roster 	= require('./src/roster');
	var now 		= new Date();
	const jobName = 'groupMaintenance';

	async function iterateGroups(groups) {
		try {
			for (let index = 0; index < groups.length; index++){
				let group = groups[index];
				let res = await Roster.updateMany({group:group._id}, {status: 'finished'});
				log('info','' + jobName + ': se encontraron '+ res.n + ' rosters y se modificaron '+ res.nModified + ' para el grupo '+ group._id);
				group.status = 'closed';
				try {
					await group.save();
					log('info','' + jobName + ': El grupo con id '+ group._id + ' ha sido modificado');
				} catch(err) {
					log('error',' +' + jobName + '+ : El grupo con id' + group._id + ' al guardar arrojo un error:' + err);
				}
			}
			let finished = new Date();
			let dif = finished - now;
			let calc = calculateMilis(dif);
			log('info','' + jobName + ': Terminando procesamiento en ' + groups.length + ' grupos');
			log('info','El job ' + jobName + ' ha terminado. ' + finished);
			log('info','El tiempo de corrida para el job ' + jobName + ' fue de ' + calc.number + ' ' + calc.units);
			return;
		} catch (err) {
			log('error','' + jobName + ': Se ha generado un error al actualizar los rosters con error: '+ err);
		}
	}

	Group.find({endDate:{$lt:now},status:'active'})
		.then(groups => {
			if(groups && groups.length > 0) {
				iterateGroups(groups);
			} else {
				let finished = new Date();
				let dif = finished - now;
				let calc = calculateMilis(dif);
				log('info','' + jobName + ': No se encontraron grupos');
				log('info','El job ' + jobName + ' ha terminado. ' + finished);
				log('info','El tiempo de corrida para job ' + jobName + ' fue de ' + calc.number + ' ' + calc.units);
			}
		}
		).catch(err => {
			log('error','' + jobName + ': Hubo un error al buscar los grupos con error: ' + err);
		});
	log('info','Iniciando corrida de job ' + jobName + ' a las ' + now);
}, null, true, tz);


// Private Functions

function encodeMongoURI (urlString) {
	if (urlString) {
		let parsed = uriFormat.parse(urlString);
		urlString = uriFormat.format(parsed);
	}
	return urlString;
}

function log(level,message) {
	console.log(message); //eslint-disable-line
	switch (level) {
	case 'info':
		logger.info(message);
		break;
	case 'warn':
		logger.warn(message);
		break;
	case 'error':
		logger.error(message);
		break;
	default:
		logger.info(message);
	}
}

function calculateMilis(number) {
	let obj = {
		number: number,
		units: 'milisegs'
	};
	if(number > 1000) {
		if(number > 60000) {
			if(number > 3600000) {
				obj.number = number / 3600000;
				obj.units = 'hrs';
			} else {
				obj.number = number / 60000;
				obj.units = 'mins';
			}
		} else {
			obj.number = number / 1000;
			obj.units = 'segs';
		}
	}
	return obj;
}