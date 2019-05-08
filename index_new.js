const version		= require('./version/version');
const log 			= require('./shared/log').log;

log('info', version.app + '@' + version.version + ' ' + version.vendor + ' \u00A9' + version.year);

require('./lib/db');
require('./app');
