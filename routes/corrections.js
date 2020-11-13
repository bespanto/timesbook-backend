const express = require("express");
const moment = require("moment");
const router = express.Router();
const User = require("../models/User");
const Correction = require("../models/Correction");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const validate = require("validate.js");

/**
 * Delete a flextime correction from an user by id
 *
 */
router.delete("/:id", auth, async (req, res) => {
  logger.info(`DELETE request on endpoint '/correction/${req.params.id}`);

  if (req.requestingUser.role === 'admin') {
    try {
      await Correction.findByIdAndDelete({ _id: req.params.id });
      res.status(200).send({ success: "Correction was deleted" });
    } catch (error) {
      logger.error("Error while accessing the database:" + error);
      res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
    }
  }
  else {
    logger.error("User have no permissions for this operation.");
    return res.status(403).send({ errorCode: 4010, message: "User have no permissions for this operation." });
  }

});


/**
 * Gets flextime corrections for an user 
 *
 */
router.get("/:username/flextime", auth, async (req, res) => {
  logger.info(`GET request on endpoint '/correction/${req.params.username}/flextime`);

  try {
    if (req.requestingUser.role === 'admin') {
      const corrections = await Correction.find({ username: req.params.username, type: "flextime" });
      logger.info(corrections)
      res.status(200).send({ success: { corrections: corrections } });
    }
    else {
      logger.error("User have no permissions for this operation.");
      return res.status(403).send({ errorCode: 4010, message: "User have no permissions for this operation." });
    }
  } catch (error) {
    logger.error("Error while accessing the database: " + error)
    res.status(500).send({ errorCode: 5001, message: "Error while accessing the database" });
  }
});


/**
 * Create a correction
 *
 */
router.put("/", auth, async (req, res) => {
  logger.info(
    `PUT request on endpoint '/correction/
    Body: ${JSON.stringify(req.body)}`
  );

  // check the body
  if (!moment(req.body.date, moment.ISO_8601).isValid())
    res.status(400).send({ errorCode: 4003, message: "Date is not valid value" });
  else {
    var constraints = {
      value: {
        presence: true,
        numericality: {
          onlyInteger: true,
        }
      },
    };

    const result = validate(
      { value: req.body.value },
      constraints
    );
    if (result !== undefined) {
      if (result.value)
        res.status(400).send({ errorCode: 4025, message: "Correction must be an integer" });
    }
    else
      if (req.requestingUser.role !== 'admin') {
        logger.error(`User ${req.requestingUser} have no permissions for this operation.`);
        res.status(403).send({ errorCode: 4010, message: "User have no permissions for this operation." });
      }
      else
        try {
          const user = await User.findOne({ username: req.body.username });
          if (!user) {
            logger.error(`User not found: '${req.body.username}'`);
            res.status(400).send({ errorCode: 4003, message: "No user found for the given username (e-mail)" });
          }
          else {
            const corr = new Correction({ ...req.body });
            savedCorr = await corr.save();
            res.status(200).send({ success: "Correction was saved" });
          }
        } catch (error) {
          logger.error("Error while accessing Database:" + error);
          res.status(500).send({ errorCode: 5001, message: "Error while accessing Database" });
        }
  }
});


module.exports = router;
