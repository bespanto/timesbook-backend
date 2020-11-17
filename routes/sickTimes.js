const express = require("express");
const validate = require("validate.js");
const remainingVacation = require("../utils/remainingVacation");
const router = express.Router();
const moment = require("moment");
const SickTime = require("../models/SickTime");
const User = require("../models/User");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const mailer = require("../utils/mailer");


/**
 *  Deletes a specific sick time
 */
router.delete("/:id", auth, async (req, res) => {
  logger.info(`DELETE request on endpoint /sickTime/${req.params.id}`);

  try {
    if (req.requestingUser.role !== 'admin')
      res.status(403).send({ errorCode: 4010, message: "You have no permission for this operation" });
    else {
      const vacations = await SickTime.deleteOne({ _id: req.params.id });
      res.status(200).send({ success: "Sick time was successfuly deleted" });
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }

});



/**
 * Create a sick time
 *
 */
router.post("/", auth, async (req, res) => {
  logger.info(`POST request on endpoint /sickTime
      Body: + ${JSON.stringify(req.body)}`);

  var constraints = {
    from: {
      presence: true
    },
    till: {
      presence: true
    },
  };

  const result = validate(req.body, constraints);
  if (result !== undefined) {
    res.status(400).send({ errorCode: 4014, message: "The body has required fields: 'from', 'till'" })
  }
  if (!moment(req.body.from).isValid() ||
    !moment(req.body.till).isValid()) {
    res.status(400).send({ errorCode: 4012, message: "The input contains invalid date" })
  } else {

    const start = moment.utc(req.body.from);
    const end = moment.utc(req.body.till);
    if (start.isAfter(end)) {
      res.status(400).send({ errorCode: 4013, message: "'from' can not be later as 'till'" })
    }
    else {
      try {
        if (req.requestingUser.role !== 'admin')
          res.status(403).send({ errorCode: 4010, message: "You have no permission for this operation" });
        else {
          const sickTime = new SickTime({
            username: req.body.username,
            from: req.body.from,
            till: req.body.till
          });
          const savedSickTime = await sickTime.save();
          res.status(200).send({ success: savedSickTime});
        }
      } catch (error) {
        logger.error("Error while accessing Database: " + error);
        res.status(500).send({ errorCode: 5001, message: error });
      }
    }
  }
});

/**
 *  Gets all sick times
 */
router.get("/", auth, async (req, res) => {
  logger.info(`GET request on endpoint /sickTime`);

  try {
    if (req.requestingUser.role !== 'admin')
      return res.status(403).send({ errorCode: 4010, message: "You have no permissions to retrive data for another user" });
    else {
      const users = await User.find({ organization: req.requestingUser.organization });
      const sickTimes = await SickTime.find({ username: { $in: users.map(el => el.username) } });
      res.status(200).send({ success: sickTimes });
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }

});


/**
 *  Gets sick times by username
 */
router.get("/:username", auth, async (req, res) => {
  logger.info(`GET request on endpoint /sickTime/${req.params.username}`);

  try {
    if (req.requestingUser.username !== req.params.username || req.requestingUser.role !== 'admin')
      return res.status(403).send({ errorCode: 4010, message: "You have no permissions to retrive data for another user" });
    else {
      const sickTimes = await SickTime.find({ username: req.params.username });
      res.status(200).send({ success: sickTimes });
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }

});


module.exports = router;
