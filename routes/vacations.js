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
 * Create a vacation antry for an user
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

      const user = await User.findById(req.decodedToken._id, { password: 0, _id: 0 });
      if (!user)
        return res.status(401).send({ errorCode: 4009, message: "No user found for the given id" });

      const admin = await User.findOne({ organisation: user.organisation, role: 'admin' });

      const vacationEntry = new Vacation({
        username: req.params.username,
        from: req.body.from,
        till: req.body.till,
        status: "pending"
      });
      try {
        const savedVacationEntry = await vacationEntry.save();
        logger.debug("The vacation was sucessfully added: " + JSON.stringify(savedVacationEntry));

        mailer(
          req.body.username,
          "<p>Sehr geehrter Admin,</p><br>" +
          `<p>Sie haben in Ihrer Organisation (${req.body.organization}) eine Urlaubsanfrage vom Mitarbeiter ${user.name} erhalten.</p>` +
          `<p>Um die Anfrage zu bearbeiten loggen Sie sich bei Timesbook ein:</p><br/>` +
          `<p><a href="http://localhost:3000/Login">http://localhost:3000/Login</a></p><br/>` +
          "<p>Timesbook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
          "Timesbook")
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
