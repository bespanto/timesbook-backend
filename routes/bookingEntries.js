const express = require('express');
const moment = require('moment');
const auth = require('./verifyToken');
const router = express.Router();
const BookingEntry = require('../models/BookingEntry');
const logger = require('../logger');

/**
 * 
 * @param {*} message 
 */
function InvalidDateException(message) {
    this.name = 'InvalidDateException',
        this.message = message;
}

/**
 * Prüft ob start vor end und start, end innerhalb von day liegt.
 * 
 */
function checkTimes(reqDay, reqStart, reqEnd, reqPause = '00:00') {

    if (reqDay === '' || reqStart === '' || reqEnd === '' || reqPause === '')
        throw new InvalidDateException('times cannot be empty');

    checkStartEnd(reqStart, reqEnd)

    if (!moment(reqDay, moment.ISO_8601).isValid())
        throw new InvalidDateException('\'day\' is not ISO 8601 string');

    const day = moment(reqDay, moment.ISO_8601);
    const start = moment(reqStart, moment.ISO_8601);
    const end = moment(reqEnd, moment.ISO_8601);


    if (!start.isAfter(day))
        throw new InvalidDateException('\'start\' is out of booking day');
    if (!end.isBefore(day.add(1, 'days')))
        throw new InvalidDateException('\'end\' is out of booking day');

    reqPause = reqPause.trim()
    const patt = new RegExp('/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/');
    if (patt.test(reqPause))
        throw new InvalidDateException('\'pause\' has not the form hh:mm');
    const pause = moment.duration(reqPause);
    const workingTime = moment.duration(end.diff(start));
    if (workingTime - pause <= 0)
        throw new InvalidDateException('working time (difference between \'end\' and \'start\') must be greater then \'pause\'');
}

/**
 * 
 */
function checkStartEnd(reqStart, reqEnd) {

    if (!moment(reqStart, moment.ISO_8601).isValid())
        throw new InvalidDateException('\'start\' is not ISO 8601 string');
    if (!moment(reqEnd, moment.ISO_8601).isValid())
        throw new InvalidDateException('\'end\' is not ISO 8601 string');

    const start = moment(reqStart, moment.ISO_8601);
    const end = moment(reqEnd, moment.ISO_8601);

    if (!end.isAfter(start))
        throw new InvalidDateException('\'start\' cannot be before \'end\'');
}

/**
 * Prüft, ob day richtiges Datumsformat hat.
 * 
 */
function checkDay(reqDay) {
    let day;
    if (!moment(reqDay, moment.ISO_8601).isValid())
        throw new InvalidDateException('\'day\' is not ISO 8601 string')
    else
        return day = new Date(reqDay);
}

/**
 * 
 */
function trimBody(body) {
    if (body.username !== undefined)
        body.username = body.username.trim()
    if (body.start !== undefined)
        body.start = body.start.trim()
    if (body.end !== undefined)
        body.end = body.end.trim()
    if (body.pause !== undefined)
        body.pause = body.pause.trim()
    if (body.activities !== undefined)
        body.activities = body.activities.trim()
    return {
        username: body.username,
        day: body.day,
        start: body.start,
        end: body.end,
        pause: body.pause,
        activities: body.activities
    }
}

/**
 * Create new booking entry
 * 
 */
router.post('/:username', auth,
    async (req, res) => {
        logger.info('POST - username: ' + req.params.username + ', body: ' + JSON.stringify(req.body));
        try {
            body = trimBody(req.body)
            checkTimes(body.day, body.start, body.end, body.pause);
            const bookingEntry = new BookingEntry({
                username: req.params.username,
                day: body.day,
                start: body.start,
                end: body.end,
                pause: body.pause,
                activities: body.activities
            })
            try {
                const savedBookingEntry = await bookingEntry.save();
                logger.debug(JSON.stringify(savedBookingEntry));
                res.json(savedBookingEntry);
            } catch (error) {
                logger.error(err);
                res.status(500).json(err);
            }
        } catch (err) {
            logger.error(err);
            res.status(400).json(err);
        }
    });

/**
 * Get all booking entries
 * 
 */
router.get('/:username', auth,
    async (req, res) => {
        logger.info(`GET - username: ${req.params.username}`);
        try {
            const bookingEntries = await BookingEntry.find({ username: req.params.username });
            logger.debug(JSON.stringify(bookingEntries));
            res.json(bookingEntries);
        } catch (error) {
            logger.error(error);
            res.json({ message: error })
        }

    });

/**
 * Get booking entries by day
 * 
 */
router.get('/:username/:day', auth,
    async (req, res) => {
        logger.info(`GET - username: ${req.params.username}, day: ${req.params.day}`);
        try {
            const day = checkDay(req.params.day);
            const bookingEntry = await BookingEntry.find({ day: day, username: req.params.username });
            logger.debug(JSON.stringify(bookingEntry));
            res.json(bookingEntry);
        } catch (error) {
            logger.error(error);
            res.json({ message: error })
        }

    });

/**
 * Get booking entries between two days
 * 
 */
router.get('/:username/:fromDay/:tillDay', auth,
    async (req, res) => {
        logger.info(`GET - username: ${req.params.username}, from: ${req.params.fromDay}, till: ${req.params.tillDay}`);
        try {
            const day = checkStartEnd(req.params.fromDay, req.params.tillDay);
            const bookingEntries = await BookingEntry.find({ username: req.params.username, $and: [{ day: { $gte: new Date(req.params.fromDay) } }, { day: { $lte: new Date(req.params.tillDay) } }] });
            logger.debug(JSON.stringify(bookingEntries));
            res.json(bookingEntries);
        } catch (error) {
            logger.error(error);
            res.json({ message: error })
        }

    });

/*
* Update a booking entry
*
*/
router.patch('/:username', auth,
    async (req, res) => {
        logger.info('PACTH - username: ' + req.params.username + ', body: ' + JSON.stringify(req.body));
        try {
            body = trimBody(req.body)
            checkTimes(body.day, body.start, body.end, body.pause);
            const updatedBookingEntry = await BookingEntry.updateOne(
                { day: body.day, username: req.params.username },
                {
                    $set: {
                        username: req.params.username,
                        day: body.day,
                        start: body.start,
                        end: body.end,
                        pause: body.pause,
                        activities: body.activities
                    }
                },
                { upsert: true });
            res.json(req.body);
        } catch (error) {
            if (error.name === 'InvalidDateException') {
                logger.error(error.message);
                res.status(400).json({ 'error': error.message });
            }
            else {
                logger.error(error);
                res.json({ messagesssss: error })
            }
        }
    });

/**
 * Delete entry by booking day
 * 
 */
router.delete('/:username/:day', auth,
    async (req, res) => {
        logger.info(`DELETE - username: ${req.params.username}, day: ${req.params.day}`);
        try {
            const day = checkDay(req.params.day);
            const deletedBookingEntry = await BookingEntry.deleteMany({ day: day, username: req.params.username });
            res.json(deletedBookingEntry);
        } catch (error) {
            logger.error(error);
            res.json({ message: error })
        }

    });

module.exports = router;