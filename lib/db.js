const mongoose 		= require( 'mongoose' );
const uriFormat 	= require( 'mongodb-uri' );
const app					= require('../app');
const log 				= require('../shared/log').log;
mongoose.Promise 	= global.Promise;

const dbURI = process.env.MONGO_URI || 'mongodb://operator:Password01@mongo:27017/alumno';

let options = {
	autoReconnect: true,
	reconnectTries: 10,
	reconnectInterval: 1000,
	poolSize: 10,
	useNewUrlParser: true
};

// Create the database connection
mongoose.connect(encodeMongoURI(dbURI), options);
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);

// Agregado para hacer debug. Apagar inmediatamente y por ningún motivo prenderlo en producción
if(process.env.NODE_ENV &&
	(
		process.env.NODE_ENV === 'development' ||
		process.env.NODE_ENV === 'test'
	) &&
	process.env.NODE_DEBUG &&
	process.env.NODE_DEBUG === 'on'){
	mongoose.set('debug',true);
}

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function () {
	let now = new Date();
	log('info','Conexion a la base de datos abierta exitosamente. ' + now);
});

mongoose.connection.once('open', function() {
	// Ya estamos conectados... seguimos con app
	app.emit('ready');
});

// If the connection throws an error
mongoose.connection.on('error',function (err) {
	let now = new Date();
	log('error','Error de conexion a la base de datos: ' + err + ' ' + now);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
	let now = new Date();
	log('warn','Se perdio la conexion a la base. ' + now);
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function() {
	mongoose.connection.close(function () {
		let now = new Date();
		log('info','El servicio y la conexion a la base han sido terminados exitosamente. ' + now);
		process.exit(0);
	});
});


// Private Functions

function encodeMongoURI (urlString) {
	if (urlString) {
		let parsed = uriFormat.parse(urlString);
		urlString = uriFormat.format(parsed);
	}
	return urlString;
}
