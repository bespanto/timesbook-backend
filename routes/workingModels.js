const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const validate = require("validate.js");
const router = express.Router();
const User = require("../models/User");
const BookingEntry = require("../models/BookingEntry");
const auth = require("./verifyToken");
const cryptoRandomString = require("crypto-random-string");
const logger = require("../utils/logger");
const mailer = require("../utils/mailer");


/**
 * Delete working model from an user by id
 *
 */
router.delete("/:id", auth, async (req, res) => {
  logger.info(
    "DELETE request on endpoint '/workingModel/:id'. Id: " + req.params.id);

  try {
    await User.updateMany({}, {$pull: { workingModels: {_id: req.params.id}}});
    logger.debug('Deleted')
    res.status(200).send({ success: "User was deleted" });
  } catch (error) {
    logger.error("Error while accessing the database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});


/**
 * Gets ascending sorted working models for an user 
 *
 */
router.get("/:username", auth, async (req, res) => {
  logger.info("GET request on endpoint '/workingModel/:username'" + "Username: " + req.params.username);

  try {
    if (req.requestingUser.role === 'admin') {
      const requestedUser = await User.findOne(
        { username: req.params.username, organization: req.requestingUser.organization },
        { password: 0, _id: 0, registrationKey: 0 });
      if (!requestedUser) {
        logger.error("User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'");
        return res.status(400).send({ errorCode: 4021, message: "User '" + req.params.username + "' was not found in organization '" + req.requestingUser.organization + "'" });
      }
      else {
        if (requestedUser.workingModels && requestedUser.workingModels.length > 0) {
          requestedUser.workingModels.sort((a, b) => a.validFrom - b.validFrom)
          res.status(200).send({ success: { workingModels: requestedUser.workingModels } });
        }
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


/**
 * Updates working model for an user
 *
 */
router.patch("/:username", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/workingModel/:username'. Username: " + req.params.username +
    "; body: " + JSON.stringify(req.body)
  );

  try {
    const user = await User.findOne({ username: req.params.username });
    console.log(user)
    if (!user) {
      logger.error("User not found: " + req.params.username);
      res.status(400).send({ errorCode: 4003, message: "No user found for the given username (e-mail)" });
    }
    else {
      if (user.workingModels && user.workingModels.length > 0) {
        user.workingModels.sort((a, b) => a.validFrom - b.validFrom)
        var duration = moment.duration(moment(req.body.validFrom).diff(moment(user.workingModels[user.workingModels.length - 1].validFrom))).asDays();
        if (duration < 1) {
          logger.error("A day must be from last working model");
          res.status(400).send({ errorCode: 4024, message: "A day must be from last working model" });
        }
        else {
          await User.updateOne(
            { username: req.params.username },
            { $push: { workingModels: req.body, }, }
          );
          res.status(200).send({ success: "User(s) updated" });
        }
      }
      else {
        await User.updateOne(
          { username: req.params.username },
          { $push: { workingModels: req.body, }, }
        );
        res.status(200).send({ success: "User(s) updated" });
      }
    }
  } catch (error) {
    logger.error("Error while accessing Database:" + error);
    res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
  }
});

module.exports = router;
