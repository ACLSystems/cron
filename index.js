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
const groupActivateStatusSchedule = process.env.JOBGROUPACTIVATESTATUS || '*/30 * * * * *';
const userFiscalRepairSchedule = process.env.JOBUSERFISCALREPAIR || '*/30 * * * * *';
const setProjectSchedule = process.env.JOBSETPROJECT || '*/30 * * * * *';

// Aquí se colocarán los jobs en el arreglo
const JOBS = [];
const JOBNAMES = [];

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
	// Nombre de los jobs
	permJob.jobName 					= 'Permanente';
	groupExpireJob.jobName 		= 'Expira grupos';
	groupActivateJob.jobName 	= 'Activa grupos';
	groupActivateStatusJob.jobName = 'Status grupos';
	userFiscalRepairJob.jobName = 'Repara fiscal en users';
	setProjectJob.jobName = 'Project en Rosters';

	// Metemos los nombres de los jobs en el arreglo de JOBS
	JOBNAMES.push(permJob.jobName);
	JOBNAMES.push(groupExpireJob.jobName);
	JOBNAMES.push(groupActivateJob.jobName);
	JOBNAMES.push(groupActivateStatusJob.jobName);
	JOBNAMES.push(userFiscalRepairJob.jobName);
	JOBNAMES.push(setProjectJob.jobName);

	JOBS.push(permJob);
	JOBS.push(groupExpireJob);
	JOBS.push(groupActivateJob);
	JOBS.push(groupActivateStatusJob);
	JOBS.push(userFiscalRepairJob);
	JOBS.push(setProjectJob);

	// Generamos la cadena del nombre del job
	permJob.jobNameSpaces 					= spacesTab(permJob.jobName);
	groupExpireJob.jobNameSpaces 		= spacesTab(groupExpireJob.jobName);
	groupActivateJob.jobNameSpaces 	= spacesTab(groupActivateJob.jobName);
	groupActivateStatusJob.jobNameSpaces 	= spacesTab(groupActivateStatusJob.jobName);
	userFiscalRepairJob.jobNameSpaces 		= spacesTab(userFiscalRepairJob.jobName);
	setProjectJob.jobNameSpaces = spacesTab(setProjectJob.jobName);
	log('info',displayDate(new Date()) + ' || ' + spacesTab(version.app) + ' Conexion a la base de datos abierta exitosamente');
	log('info',displayDate(new Date()) + ' || ' + spacesTab(version.app) + ' '+ JOBS.length + ' jobs listos para correr en la programacion definida');

	// Corrida de JOBS
	permJob.start();
	groupExpireJob.start();
	groupActivateJob.start();
	groupActivateStatusJob.start();
	userFiscalRepairJob.start();
	setProjectJob.start();
	JOBS.forEach(job => {
		log('info',displayDate(new Date()) + ' || ' + job.jobNameSpaces + ' Siguiente corrida: ' + job.nextDates(1).map(date => displayDate(date)));
	});
});

// Si la conexión manda un error
mongoose.connection.on('error',function (err) {
	log('error',displayDate(new Date()) + ' || ' + spacesTab(version.app) + ' Error de conexion a la base de datos: ' + err);
});

// Cuando la conexión a la base se pierde
mongoose.connection.on('disconnected', function () {
	log('warn',displayDate(new Date()) + ' || ' + spacesTab(version.app) + ' Se perdio la conexion a la base');
});

// Si el proceso de NodeJS termina
process.on('SIGINT', function() {
	mongoose.connection.close(function () {
		log('info',displayDate(new Date()) + ' || ' + spacesTab(version.app) + ' El servicio y la conexion a la base han sido terminados exitosamente');
		process.exit(0);
	});
});

// JOBS --------------------------------------------------------------
// -------------------------------------------------------------------

// Job Permanente
// Este job se puede usar para actividades cotidianas de servidor...
var permJob = new cronJob(permJobSchedule, function() {
	const now = new Date();
	log('info','' + this.jobNameSpaces + ' Iniciando. ' + now);
	// ----------------- Actividades a ejecutar
	// -----------------
	displayFinished(now,this);
}, null, true, tz);

// Job para expiración de grupos
const groupExpireJob = new cronJob(groupExpireSchedule, async function() {
	var now 		= new Date();
	const query = {
		endDate:{
			$lt:now
		},
		status:'active'
	};
	const status = 'closed';
	log('info',displayDate(now) + ' || ' + this.jobNameSpaces + ' Iniciando');
	await searchExpGroups(query,status,now,this);
}, null, true, tz);

// Job para activación de grupos
const groupActivateJob = new cronJob(groupActivateSchedule, async function() {
	var now 		= new Date();
	const query = {
		beginDate:{
			$lt:now
		},
		status:'coming'
	};
	const status = 'active';
	log('info',displayDate(now) + ' || ' + this.jobNameSpaces + ' Iniciando');
	await searchGroups(query,status,now,this);
}, null, true, tz);

// Job para setear propiedad 'status' de grupos
// Grupos viejos que no tuvieron esta propiedad
const groupActivateStatusJob = new cronJob(groupActivateStatusSchedule, async function() {
	const now = new Date();
	const query = {
		status:{
			$exists:false
		}
	};
	log('info',displayDate(now) + ' || ' + this.jobNameSpaces + ' Iniciando');
	await searchGroups(query,'active',now,this);
}, null, true, tz);

// Job para reparar/migrar usuarios con propiedad Fiscal anterior
const userFiscalRepairJob = new cronJob(userFiscalRepairSchedule, async function() {
	const now = new Date();
	const limit = 100;
	const query = {
		fiscal:{
			$exists:true
		},
		'fiscal.id': {
			$exists: true
		},
		flag1:{
			$exists:false
		}
	};
	log('info',displayDate(now) + ' || ' + this.jobNameSpaces + ' Iniciando con límite de ' + limit + ' usuarios en la búsqueda');
	await searchFiscalUsers(query,limit,now,this);
}, null, true, tz);

var setProjectJob = new cronJob(setProjectSchedule, function() {
	const now = new Date();
	const limit = 100;
	const project = '5d07d5a4707be10017e695b9';
	const query = {
		project: project
	};
	searchSEPHGroups(query,limit,now,this);
	log('info',displayDate(now) + ' || ' + this.jobNameSpaces + ' Iniciando con límite de ' + limit + ' usuarios en la búsqueda');
}, null, true, tz);

// Funciones privadas ------------------------------------------------
// -------------------------------------------------------------------
// -------------------------------------------------------------------

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
	JOBNAMES.forEach(s => {
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

function displayFinished(now,job) {
	let finished = new Date();
	let dif = finished - now;
	let calc = calculateMilis(dif);
	log('info',displayDate(finished) + ' || ' + job.jobNameSpaces + ' Terminado');
	log('info',displayDate(finished) + ' || ' + job.jobNameSpaces + ' Tiempo de corrida: ' + calc.number + ' ' + calc.units);
	log('info',displayDate(finished) + ' || ' + job.jobNameSpaces + ' Siguiente corrida: ' + job.nextDates(1).map(date => displayDate(date)));
	return;
}

async function iterateGroups(groups,status,now,that) {
	try {
		for (let index = 0; index < groups.length; index++){
			let group = groups[index];
			group.status = status;
			try {
				await group.save();
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' El grupo '+ group.code + ' con fecha de inicio: ' + displayDate(group.beginDate) + ' ha sido activado');
			} catch(err) {
				log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' El grupo ' + group.code + ' al guardar arrojo un error:' + err);
			}
		}
		log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + groups.length + ' grupos');
		displayFinished(now,that);
		return;
	} catch (err) {
		log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Se ha generado un error al actualizar los grupos: '+ err);
	}
}

async function searchGroups(query,status,now,that){
	const Group 	= require('./src/groups');
	await Group.find(query)
		.then(groups => {
			if(groups && groups.length > 0) {
				iterateGroups(groups,status,now,that);
			} else {
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' No se encontraron grupos');
				displayFinished(now,that);
			}
		}
		).catch(err => {
			log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Hubo un error al buscar los grupos con error: ' + err);
		});
}

async function expIterateGroups(groups,status,now,that) {
	const Roster 	= require('./src/roster');
	try {
		for (let index = 0; index < groups.length; index++){
			let group = groups[index];
			let res = await Roster.updateMany({group:group._id}, {status: 'finished'});
			log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces +  ' ' + res.n + ' rosters encontrados y '+ res.nModified + ' modificados para el grupo '+ group.code);
			group.status = status;
			try {
				await group.save();
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' El grupo '+ group.code + ' con fecha de expiración ' + displayDate(group.endDate) + ' ha sido cerrado');
			} catch(err) {
				log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' El grupo ' + group.code + ' al guardar arrojo un error:' + err);
			}
		}
		log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + groups.length + ' grupos');
		displayFinished(now,that);
	} catch (err) {
		log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Se ha generado un error al actualizar los rosters con error: '+ err);
	}
}

async function searchExpGroups(query,status,now,that){
	const Group 	= require('./src/groups');
	await Group.find(query)
		.then(groups => {
			if(groups && groups.length > 0) {
				expIterateGroups(groups,status,now,that);
			} else {
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' No se encontraron grupos');
				displayFinished(now,that);
			}
		}
		).catch(err => {
			log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al buscar los grupos con error: ' + err);
		});
}

// Función que crea al FiscalContact y
// Actualiza al User
async function fiscalAndUser(user,now,that) {
	const FiscalContact = require('./src/fiscalContacts');
	if(typeof user.fiscal === 'object' && user.fiscal.id) {
		let fc = new FiscalContact({
			identification: user.fiscal.id,
			name: user.person.name + ' ' + user.person.fatherName + ' ' +user.person.motherName,
			observations: 'Usuario migrado',
			email: user.person.email,
			type: 'client',
			cfdiUse: 'G03',
			orgUnit: user.orgUnit,
			mod: [{
				what: 'Fiscal creation - cron migrated',
				when: now,
				by: 'System'
			}]
		});
		await fc.save().then((fiscal) => {
			user.admin.initialPassword = fiscal.identification;
			user.fiscal = [fiscal._id];
			user.markModified('fiscal');
			user.flag1 = 'Fiscal del usuario migrado';
			user.save().catch(err => {
				log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al guardar al usuario corregido '+ user.name +' con error: ' + err);
			});
		}).catch(err => {
			log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al guardar al FiscalContact '+ user.fiscal.id +' con error: ' + err);
		});
	}
}

// función para buscar a usuarios que todavía
// tengan una propiedad fiscal antigua
async function searchFiscalUsers(query,limit,now,that) {
	const User = require('./src/users');
	await User.find(query)
		.limit(limit)
		.then(users => {
			if(users && users.length > 0) {
				users.forEach(user => {
					fiscalAndUser(user,now,that);
				});
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + users.length + ' usuarios');
				displayFinished(now,that);
				return;
			} else {
				log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' No se encontraron usuarios para migrar');
				displayFinished(now,that);
			}
		}).catch(err => {
			log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al buscar los usuarios con error: ' + err);
		});
}

async function searchRostersProject(group,now,that) {
	const Roster = require('./src/roster');
	await Roster.find({group: group._id})
		.then(items => {
			if(items && items.length >0) {
				items.forEach(item => {
					item.project = group.project;
					item.save().catch(err => {
						log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al guardar al roster corregido '+ item._id +' con error: ' + err);
					});
				});
			}
		}).catch(err => {
			log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al buscar los rosters con error: ' + err);
		});
}

// función para buscar a usuarios que todavía
// tengan una propiedad fiscal antigua
async function searchSEPHGroups(query,limit,now,that) {
	const Group = require('./src/groups');
	try {
		const groups = await Group.find(query).limit(limit);
		if(groups && groups.length > 0) {
			for(var i=0; i < groups.length; i++) {
				await searchRostersProject(groups[0],now,that);
			}
			log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' Terminando procesamiento para ' + groups.length + ' groups');
			displayFinished(now,that);
			return;
		} else {
			log('info',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ' No se encontraron grupos para migrar');
			displayFinished(now,that);
		}
	} catch (err) {
		log('error',displayDate(new Date()) + ' || ' + that.jobNameSpaces + ': Hubo un error al buscar los grupos con error: ' + err);
	}
}
