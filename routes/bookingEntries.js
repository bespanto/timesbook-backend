const express = require("express");
const router = express.Router();
const moment = require("moment");
const flextime = require("../utils/flextime");
const auth = require("./verifyToken");
const BookingEntry = require("../models/BookingEntry");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Exception for date checks
 */
function InvalidDateException(message) {
  (this.name = "InvalidDateException"), (this.message = message);
}

/**
 * Checks:
 *      1. Date and time formats
 *      2. 'start' befor 'end'.
 *      3. 'start' and 'end' within booking day
 *
 */
function checkTimes(reqDay, reqStart, reqEnd, reqPause = "00:00") {
  if (reqDay === "" || reqStart === "" || reqEnd === "" || reqPause === "")
    throw new InvalidDateException("times cannot be empty");

  checkStartEnd(reqStart, reqEnd);

  if (!moment(reqDay, moment.ISO_8601).isValid())
    throw new InvalidDateException("'day' is not ISO 8601 string");

  const day = moment(reqDay, moment.ISO_8601);
  const start = moment(reqStart, moment.ISO_8601);
  const end = moment(reqEnd, moment.ISO_8601);

  reqPause = reqPause.trim();
  const patt = new RegExp("/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/");
  if (patt.test(reqPause))
    throw new InvalidDateException("'pause' has not the form hh:mm");
  const pause = moment.duration(reqPause);
  const workingTime = moment.duration(end.diff(start));
  if (workingTime - pause <= 0)
    throw new InvalidDateException(
      "working time (difference between 'end' and 'start') must be greater then 'pause'"
    );
}

/**
 * Checks:
 *      1. Date format
 *      2. 'start' befor 'end'.
 */
function checkStartEnd(reqStart, reqEnd) {
  if (!moment(reqStart, moment.ISO_8601).isValid())
    throw new InvalidDateException("'start' is not ISO 8601 string");
  if (!moment(reqEnd, moment.ISO_8601).isValid())
    throw new InvalidDateException("'end' is not ISO 8601 string");

  const start = moment(reqStart, moment.ISO_8601);
  const end = moment(reqEnd, moment.ISO_8601);

  if (!end.isAfter(start))
    throw new InvalidDateException("'start' cannot be before 'end'");
}

/**
 * Checks day format
 *
 */
function checkDay(reqDay) {
  let day;
  if (!moment(reqDay, moment.ISO_8601).isValid())
    throw new InvalidDateException("'day' is not ISO 8601 string");
  else return (day = new Date(reqDay));
}

/**
 * Trim body entries
 */
function trimBody(body) {
  if (body.username !== undefined) body.username = body.username.trim();
  if (body.start !== undefined) body.start = body.start.trim();
  if (body.end !== undefined) body.end = body.end.trim();
  if (body.pause !== undefined) body.pause = body.pause.trim();
  if (body.activities !== undefined) body.activities = body.activities.trim();
  return {
    username: body.username,
    day: body.day,
    start: body.start,
    end: body.end,
    pause: body.pause,
    activities: body.activities,
  };
}

/**
 * Get booking entries between two days
 *
 */
router.get("/:username/:fromDay/:tillDay", auth, async (req, res) => {
  logger.info(
    `GET request on endpoint /bookingEntries/${req.params.username}/${req.params.fromDay}/${req.params.tillDay}`
  );
  try {
    const day = checkStartEnd(req.params.fromDay, req.params.tillDay);
    const bookingEntries = await BookingEntry.find({
      username: req.params.username,
      $and: [
        { day: { $gte: new Date(req.params.fromDay) } },
        { day: { $lte: new Date(req.params.tillDay) } },
      ],
    });
    res.status(200).send({ success: { bookingEntries } });
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }
});

/*
 * Update a booking entry
 *
 */
router.patch("/:username", auth, async (req, res) => {
  logger.info(`PACTH - request on endpoint /bookingEntries/${req.params.username}
   body: ${JSON.stringify(req.body)}`);
  try {
    body = trimBody(req.body);
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
          activities: body.activities,
        },
      },
      { upsert: true }
    );
    res.json({ success: { bookingEntry: req.body } });
  } catch (error) {
    if (error.name === "InvalidDateException") {
      logger.error(error.message);
      res.status(400).json({ errorCode: 4019, message: error.message });
    } else {
      logger.error("Error while accessing the database:" + error);
      res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
    }
  }
});

/**
 * Delete entry by booking day
 *
 */
router.delete("/:username/:day", auth, async (req, res) => {
  logger.info(`DELETE - request on endpoint '/bookingEntries/${req.params.username}/${req.params.day}`);
  try {
    const day = checkDay(req.params.day);
    const deletedBookingEntry = await BookingEntry.deleteMany({
      day: day,
      username: req.params.username,
    });
    res.status(200).json({ success: { bookingEntry: deletedBookingEntry } });
  } catch (error) {
    logger.error("Error while accessing the database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});

/**
 * Gets an overview for an user
 *
 */
router.get("/:username/flextime", auth, async (req, res) => {
  logger.info(`GET request on endpoint '/bookingEntries/${req.params.username}/flextime'`);

  try {

    if (req.requestingUser.username === req.params.username || req.requestingUser.role === 'admin') {
      const requestedUser = await User.findOne(
        { username: req.params.username, organization: req.requestingUser.organization },
        { password: 0, _id: 0, registrationKey: 0 });
      if (!requestedUser) {
        logger.error("User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'");
        return res.status(400).send({ errorCode: 4021, message: "User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'" });
      }
      else {
        const ftime = await flextime(requestedUser);
        res.status(200).send({ success: { flextime: ftime } });
      }
    }
    else {
      logger.error("No permissions to retrieve user info.");
      return res.status(403).send({ errorCode: 4010, message: "No permissions to retrieve user info." });
    }
  } catch (error) {
    logger.error("Error while accessing the database: " + error)
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});


module.exports = router;
