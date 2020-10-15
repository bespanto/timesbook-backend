const winston = require('winston');
const { createLogger, format } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

console.log('Loggint to file: ' + process.env.LOG_FILE);
console.log('Loggint with level: ' + process.env.LOG_LEVEL);


const myformat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  );


const logger = winston.createLogger({
    myformat,
    transports: [
        new winston.transports.Console({format: myformat}),
        new winston.transports.File({format: myformat, filename: process.env.LOG_FILE })
    ]
});

logger.level = process.env.LOG_LEVEL

module.exports = logger;
