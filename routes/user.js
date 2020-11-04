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
 * Updates working model for an user
 *
 */
router.patch("/:username/workingModel", auth, async (req, res) => {
  logger.info(
    "PATCH request on endpoint '/:username/workingModel'. Username: " + req.params.username +
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
        else{
          await User.updateOne(
            { username: req.params.username },
            {
              $push: {
                workingModels: req.body,
              },
            }
          );
          res.status(200).send({ success: "User(s) updated" });
        }
      }
      else{
        await User.updateOne(
          { username: req.params.username },
          {
            $push: {
              workingModels: req.body,
            },
          }
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
