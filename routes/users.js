const express = require("express");
const router = express.Router();
const moment = require("moment");
const User = require("../models/User");
const BookingEntry = require("../models/BookingEntry");
const auth = require("./verifyToken");
const logger = require("../utils/logger");


/**
 * Delete user and his booking etries
 *
 */
router.delete("/:username", auth, async (req, res) => {
  logger.info(
    "DELETE request on endpoint '/:username'. Username: " + req.params.username);

  try {
    await User.deleteOne({ username: req.params.username });
    await BookingEntry.deleteMany({ username: req.params.username });
    res.status(200).send({ success: "User was deleted" });
  } catch (error) {
    logger.error("Error while accessing the database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});


/**
 * Updates the user profile
 *
 */
router.patch("/:username", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/:username'. Username: " + req.params.username +
    "; body: " + JSON.stringify(req.body)
  );

  // update the name
  if (req.body.name) {
    try {
      const update = await User.updateOne(
        { username: req.params.username },
        {
          $set: {
            name: req.body.name,
          },
        }
      );
    } catch (error) {
      logger.error("Error while accessing Database:" + error);
      res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
    }
  }

  // update the organozation name
  if (req.body.organization) {
    try {
      if (req.requestingUser.role === 'admin' && req.requestingUser.organization != req.body.organization) {
        await User.updateMany(
          { organization: req.requestingUser.organization },
          {
            $set: {
              organization: req.body.organization,
            },
          }
        );
      }
    } catch (error) {
      logger.error("Error while accessing Database:" + error);
      res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
    }
  }
  res.status(200).send({ success: "User(s) updated" });
});


/**
 * Gets all user profiles of an organization
 *
 */
router.get("/", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user'");

  try {
    if (req.requestingUser.role === "admin") {
      const users = await User.find(
        // { $and: [{ organization: req.requestingUser.organization }, { username: { $ne: req.requestingUser.username } }] },
        { organization: req.requestingUser.organization },
        { password: 0, _id: 0, registrationKey: 0 });
      res.status(200).send({ success: { users: users } });
    } else {
      logger.error("User have no permissions to retrieve other user profiles");
      return res.status(403).send({ errorCode: 4010, message: "User have no permissions to retrieve other user profiles" });
    }
  } catch (error) {
    logger.error("Error while accessing the database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }

});


/**
 * Gets user profile by JWT
 *
 */
router.get("/profile", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user/profile'");

  logger.info("Requested user: " + req.requestingUser);
  res.status(200).send({ success: { user: req.requestingUser } });

});


/**
 * Gets the user profile in the organization of the requesting user 
 *
 */
router.get("/:username", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user/:username'");

  try {
    let resObj;
    if (req.requestingUser.username === req.params.username)
      resObj = req.requestingUser;
    else
      if (req.requestingUser.role === 'admin') {
        const requestedUser = await User.findOne(
          { username: req.params.username, organization: req.requestingUser.organization },
          { password: 0, _id: 0, registrationKey: 0 });
        if (!requestedUser) {
          logger.error("User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'");
          return res.status(400).send({ errorCode: 4021, message: "User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'" });
        }
        else
          resObj = requestedUser;
      }
      else {
        logger.error("No permissions to retrieve user info.");
        return res.status(403).send({ errorCode: 4010, message: "No permissions to retrieve user info." });
      }

    logger.info("Requested user: " + resObj);
    res.status(200).send({ success: { user: resObj } });

  } catch (error) {
    logger.error("Error while accessing the database: " + error)
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});


/**
 * Gets an overview for an user
 *
 */
router.get("/:username/overview", auth, async (req, res) => {
  logger.info("GET request on endpoint '/user/:username/overview'" + " User: " + req.params.username);

  try {
    let overview = {};

    if (req.requestingUser.username === req.params.username || req.requestingUser.role === 'admin') {
      const requestedUser = await User.findOne(
        { username: req.params.username, organization: req.requestingUser.organization },
        { password: 0, _id: 0, registrationKey: 0 });
      if (!requestedUser) {
        logger.error("User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'");
        return res.status(400).send({ errorCode: 4021, message: "User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'" });
      }
      else {
        overview.overtimeAsMinutes = await getOvertimeFromUserRegistration(requestedUser);
        res.status(200).send({ success: { overview: overview } });
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

async function getOvertimeFromUserRegistration(user) {
  let overtimeAsMin = 0;
  try {
    const bookingEntries = await BookingEntry.find({
      username: user.username,
      $and: [
        { day: { $gte: new Date(moment(user.registrationDate).format('YYYY-MM-DD')) } },
        { day: { $lte: new Date() } },
      ],
    });
    if(bookingEntries){
      bookingEntries.forEach((element) => {
        const targetWorkingModel = getTargetWorkingModel(user.workingModels, element.start);
        const targetDayHours = targetWorkingModel ? targetWorkingModel[moment(element.start).day()] : 0;
        const workingTime = moment.duration(moment(element.end).diff(moment(element.start))).asMinutes();
        const pause = moment.duration(element.pause).asMinutes();
        overtimeAsMin = overtimeAsMin + workingTime - pause - (targetDayHours ? targetDayHours : 0) * 60;
      })
    }
  } catch (error) {
    throw new Error("Unable to compute overtime " + error)
  }
  return overtimeAsMin;
}


function getTargetWorkingModel(models, startTime) {

  let targetWorkingModel;
  if (models && models.length > 0) // mind. ein Arbeitsmodell definiert
    if (models.length === 1) {
      if (moment(models[0].validFrom).isSameOrBefore(moment(startTime)))
        targetWorkingModel = models[0];
    }
    else if (models.length > 1) {
      for (let index = 0; index < models.length - 1; index++) {
        if (moment(startTime).isBetween(models[index].validFrom, models[index + 1].validFrom, undefined, '[)'))
          targetWorkingModel = models[index];
        else if (index + 1 === models.length - 1)
          if (moment(startTime).isSameOrAfter(moment(models[index + 1].validFrom)))
            targetWorkingModel = models[index + 1];

      }
    }
  return targetWorkingModel;
}


module.exports = router;
