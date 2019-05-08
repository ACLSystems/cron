const logger = require('./winston-logger');

module.exports = {
	log(level,message) {
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
};
