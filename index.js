const tz 								= 'America/Mexico_City';
const mongoose 					= require( 'mongoose' );
const uriFormat 				= require( 'mongodb-uri' );
const version						= require('./version/version');
const logger 						= require('./shared/winston-logger');
const cronJob 					= require('cron').CronJob;
mongoose.Promise = global.Promise;

log('info', version.app + '@' + version.version + ' ' + version.vendor + ' \u00A9' + version.year);

// PROGRAMACION DE JOBS
// Colocar la programación aquí o preferentemente definir una variable de ambiente
const permJobSchedule		= '0 0 6 * * *'; // Todos los días a las 06:00 hrs
const groupExpireSchedule	= process.env.JOBGROUPEXPIRE || '*/30 * * * * *';
const groupActivateSchedule = process.env.JOBGROUPACTIVATE || '*/30 * * * * *';

// Aquí se colocarán los jobs en el arreglo
const JOBS = [];

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
	// Nombre de los jobs
	permJob.jobName 					= 'Permanente';
	groupExpireJob.jobName 		= 'Expira grupos';
	groupActivateJob.jobName 	= 'Activa grupos';

	// Metemos los nombres de los jobs en el arreglo de JOBS
	JOBS.push(permJob.jobName);
	JOBS.push(groupExpireJob.jobName);
	JOBS.push(groupActivateJob.jobName);

	// Generamos la cadena del nombre del job
	permJob.jobNameSpaces 					= spacesTab(permJob.jobName);
	groupExpireJob.jobNameSpaces 		= spacesTab(groupExpireJob.jobName);
	groupActivateJob.jobNameSpaces 	= spacesTab(groupActivateJob.jobName);
	log('info',displayDate(now) + ' || ' + spacesTab(version.app) + ' Conexion a la base de datos abierta exitosamente');
	log('info',displayDate(now) + ' || ' + spacesTab(version.app) + ' '+ JOBS.length + ' jobs listos para correr en la programacion definida');

	// Corrida de JOBS
	permJob.start();
	groupExpireJob.start();
	groupActivateJob.start();
	log('info',displayDate(now) + ' || ' + permJob.jobNameSpaces + ' Siguiente corrida: ' + permJob.nextDates(1).map(date => displayDate(date)));
	log('info',displayDate(now) + ' || ' + groupExpireJob.jobNameSpaces + ' Siguiente corrida: ' + groupExpireJob.nextDates(1).map(date => displayDate(date)));
	log('info',displayDate(now) + ' || ' + groupActivateJob.jobNameSpaces + ' Siguiente corrida: ' + groupActivateJob.nextDates(1).map(date => displayDate(date)));
});

// Si la conexión manda un error
mongoose.connection.on('error',function (err) {
	let now = new Date();
	log('error',displayDate(now) + ' || ' + spacesTab(version.app) + ' Error de conexion a la base de datos: ' + err);
});

// Cuando la conexión a la base se pierde
mongoose.connection.on('disconnected', function () {
	let now = new Date();
	log('warn',displayDate(now) + ' || ' + spacesTab(version.app) + ' Se perdio la conexion a la base');
});

// Si el proceso de NodeJS termina
process.on('SIGINT', function() {
	mongoose.connection.close(function () {
		let now = new Date();
		log('info',displayDate(now) + ' || ' + spacesTab(version.app) + ' El servicio y la conexion a la base han sido terminados exitosamente');
		process.exit(0);
	});
});

// JOBS

// Job Permanente
// Este job se puede usar para actividades cotidianas de servidor...
var permJob = new cronJob(permJobSchedule, function() {
	const now = new Date();
	var that = this;
	log('info','' + that.jobNameSpaces + ' Iniciando. ' + now);
	// ----------------- RUNNING ACTIVITIES
	let finished = new Date();
	let dif = finished - now;
	let calc = calculateMilis(dif);
	log('info',displayDate(finished) + ' || ' + this.jobNameSpaces + ' Terminado');
	log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
	log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Siguiente corrida: ' + that.nextDates(1).map(date => displayDate(date)));
}, null, true, tz);

// Job para expiración de grupos
const groupExpireJob = new cronJob(groupExpireSchedule, async function() {
	const Group 	= require('./src/groups');
	const Roster 	= require('./src/roster');
	var now 		= new Date();
	var that = this;

	async function iterateGroups(groups) {
		let now = new Date();
		try {
			for (let index = 0; index < groups.length; index++){
				let group = groups[index];
				let res = await Roster.updateMany({group:group._id}, {status: 'finished'});
				log('info',displayDate(now) + ' || ' + that.jobNameSpaces +  ' ' + res.n + ' rosters encontrados y '+ res.nModified + ' modificados para el grupo '+ group.code);
				group.status = 'closed';
				try {
					await group.save();
					log('info',displayDate(now) + ' || ' + that.jobNameSpaces + ' El grupo '+ group.code + ' con fecha de expiración ' + displayDate(group.endDate) + ' ha sido cerrado');
				} catch(err) {
					log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ' El grupo ' + group.code + ' al guardar arrojo un error:' + err);
				}
			}
			let finished = new Date();
			let dif = finished - now;
			let calc = calculateMilis(dif);
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + groups.length + ' grupos');
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminado');
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Siguiente corrida: ' + that.nextDates(1).map(date => displayDate(date)));
			return;
		} catch (err) {
			now = new Date();
			log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ' Se ha generado un error al actualizar los rosters con error: '+ err);
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
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' No se encontraron grupos');
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminado');
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Siguiente corrida: ' + that.nextDates(1).map(date => displayDate(date)));
			}
		}
		).catch(err => {
			now = new Date();
			log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ': Hubo un error al buscar los grupos con error: ' + err);
		});
	log('info',displayDate(now) + ' || ' + that.jobNameSpaces + ' Iniciando');
}, null, true, tz);

// Job para expiración de grupos
const groupActivateJob = new cronJob(groupActivateSchedule, async function() {
	const Group 	= require('./src/groups');
	var now 		= new Date();
	var that = this;

	async function iterateGroups(groups) {
		let now = new Date();
		try {
			for (let index = 0; index < groups.length; index++){
				let group = groups[index];
				group.status = 'active';
				try {
					await group.save();
					log('info',displayDate(now) + ' || ' + that.jobNameSpaces + ' El grupo '+ group.code + ' con fecha de inicio: ' + displayDate(group.beginDate) + ' ha sido activado');
				} catch(err) {
					log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ' El grupo ' + group.code + ' al guardar arrojo un error:' + err);
				}
			}
			let finished = new Date();
			let dif = finished - now;
			let calc = calculateMilis(dif);
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + groups.length + ' grupos');
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminado');
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
			log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Siguiente corrida: ' + that.nextDates(1).map(date => displayDate(date)));
			return;
		} catch (err) {
			now = new Date();
			log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ' Se ha generado un error al actualizar los grupos: '+ err);
		}
	}

	Group.find({beginDate:{$lt:now},status:'coming'})
		.then(groups => {
			if(groups && groups.length > 0) {
				iterateGroups(groups);
			} else {
				let finished = new Date();
				let dif = finished - now;
				let calc = calculateMilis(dif);
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' No se encontraron grupos');
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Terminado');
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
				log('info',displayDate(finished) + ' || ' + that.jobNameSpaces + ' Siguiente corrida: ' + that.nextDates(1).map(date => displayDate(date)));
			}
		}
		).catch(err => {
			now = new Date();
			log('error',displayDate(now) + ' || ' + that.jobNameSpaces + ' Hubo un error al buscar los grupos con error: ' + err);
		});
	log('info',displayDate(now) + ' || ' + that.jobNameSpaces + ' Iniciando');
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

function spacesTab(string) {
	let maxSpaces = version.app.length;
	JOBS.forEach(s => {
		if(s.length > maxSpaces) {
			maxSpaces = s.length;
		}
	});
	if(typeof string === 'string'){
		let diff = maxSpaces - string.length;
		let returnString = '';
		for(var i=0; i<diff; i++) {
			returnString = returnString + ' ';
		}
		return string + returnString + ' ||';
	} else {
		return '';
	}
}

function displayDate(date) {
	const options ={
		weekday : 'short',
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short'
	};
	return date.toLocaleString('en-US',options);
}
