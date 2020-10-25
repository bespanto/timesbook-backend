const express = require("express");
const validate = require("validate.js");
const router = express.Router();
const moment = require("moment");
const Vacation = require("../models/Vacation");
const User = require("../models/User");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const mailer = require("../utils/mailer");


/**
 *  Delets a specific vacation
 */
router.delete("/:id", auth, async (req, res) => {
  logger.info("DELETE request on endpoint '/vacation/'. Id: " + req.params.id);

  const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
  if (!user)
    return res.status(400).send({ errorCode: 4009, message: "No user found for the given id" });
  else {

    try {
      const vacations = await Vacation.deleteOne({ username: user.username, _id: req.params.id });
      res.status(200).send({success: "Vacation was successfuly deleted"});
    } catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }
  }

});

/**
 *  Gets all vacation entries by user from jwt
 */
router.get("/", auth, async (req, res) => {
  logger.info("GET request on endpoint '/vacation/'");

  const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
  if (!user)
    return res.status(400).send({ errorCode: 4009, message: "No user found for the given id" });
  else {
    try {
      const vacations = await Vacation.find({ username: user.username });
      logger.debug(vacations);
      res.status(200).send({success: {vacations}});
    } catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }
  }

});


/**
 * Create a vacation entry for an user
 *
 */
router.post("/:username", auth, async (req, res) => {
  logger.info("POST request on endpoint '/vacation/:username'. Username: " + req.params.username + " Body: " + req.body);


  validate.extend(validate.validators.datetime, {
    // The value is guaranteed not to be null or undefined but otherwise it
    // could be anything.
    parse: function (value, options) {
      return +moment.utc(value);
    },
    // Input is a unix timestamp
    format: function (value, options) {
      var format = options.dateOnly ? "YYYY-MM-DD" : "YYYY-MM-DD hh:mm:ss";
      return moment.utc(value).format(format);
    }
  });

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
  if (!moment(req.body.from, moment.ISO_8601).isValid() ||
    !moment(req.body.till, moment.ISO_8601).isValid()) {
    logger.error("'from' and 'till' must be valid dates")
    res.status(400).send({ errorCode: 4012, message: "The input contains not valid date" })
    // res.status(400).send("The password must be at least six characters long");
  } else {

    const start = moment(req.body.from, moment.ISO_8601);
    const end = moment(req.body.till, moment.ISO_8601);
    if (start.isAfter(end)) {
      logger.error("'from' can not be later as 'till'")
      res.status(400).send({ errorCode: 4013, message: "'from' can not be later as 'till'" })
    }
    else {
      try {
        const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
        if (!user)
          return res.status(400).send({ errorCode: 4009, message: "No user found for the given id" });
        else
          if (user.username !== req.params.username)
            return res.status(403).send({ errorCode: 4010, message: "You have no permissions to change data for another user" });

        const vacationEntry = new Vacation({
          username: req.params.username,
          from: req.body.from,
          till: req.body.till,
          status: "pending"
        });
        const savedVacationEntry = await vacationEntry.save();
        logger.debug("The vacation was sucessfully added: " + JSON.stringify(savedVacationEntry));

        const admin = await User.findOne({ organisation: user.organisation, role: 'admin' });
        mailer(
          req.params.username,
          "Urlaubsanfrage",
          "<p>Sehr geehrter Admin,</p><br>" +
          `<p>Sie haben eine Urlaubsanfrage vom Mitarbeiter ${user.name} erhalten. ` +
          `Sie können die Anfrage im Menü-Punkt 'Urlaubsanträge' bearbeiten.` +
          `<p><a href="http://localhost:3000/VacationRequests">http://localhost:3000/VacationRequests</a></p><br/>` +
          "<p>TimesBook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
          "TimesBook")
          .then(() => {
            logger.info("E-mail with the vacation request for '" + req.params.username + "' was send to admin: '" + admin.username + "'");
            res.status(200).send({ success: "The vacation was sucessfully added" });
          })
          .catch((err) => {
            logger.error("Error while sending e-mail: " + err);
            res.status(500).send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
          });
      } catch (error) {
        logger.error("Error while accessing Database: " + error);
        res.status(500).send({ errorCode: 5001, message: error });
      }
    }
  }
});


module.exports = router;
