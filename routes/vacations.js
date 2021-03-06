const express = require("express");
const validate = require("validate.js");
const remainingVacation = require("../utils/remainingVacation");
const { getVacations } = require("../utils/TimeIntervalUtils");
const router = express.Router();
const moment = require("moment");
const Vacation = require("../models/Vacation");
const User = require("../models/User");
const auth = require("./verifyToken");
const logger = require("../utils/logger");
const mailer = require("../utils/mailer");


/**
 *  Patch a specific vacation
 */
router.patch("/:id", auth, async (req, res) => {
  logger.info("PATCH request on endpoint '/vacation/'. Id: " + req.params.id + ", body: " + JSON.stringify(req.body));

  if (req.requestingUser.role !== 'admin') {
    logger.info("You have no permissions to change vacation data for another user");
    return res.status(403).send({ errorCode: 4010, message: "You have no permissions to change vacation data for another user" });
  }
  else
    try {
      const vacations = await Vacation.updateOne(
        { _id: req.params.id },
        {
          $set: {
            status: req.body.status,
          },
        }
      );
      const vacation = await Vacation.findById(req.params.id);
      let status;
      switch (req.body.status) {
        case 'approved':
          status = 'genehmigt';
          break;
        case 'rejected':
          status = 'abgelehnt';
          break;
        case 'canceled':
          status = 'storniert';
          break;
        default:
          break;
      }
      status =
        mailer(
          vacation.username,
          "TimesBook: Ihr " + (status === 'storniert' ? "Urlaub" : "Urlaubsantrag") + " vom " + moment(vacation.from).format('DD.MM.YYYY') + " bis " + moment(vacation.till).format('DD.MM.YYYY'),
          "<p>Sehr geehrter Nutzer,</p>" +
          "<p>Ihr " + (status === 'storniert' ? "Urlaub" : "Urlaubsantrag") + " wurde  " + status + ".</p>" +
          "<p>TimesBook wünscht Ihnen gute und angenehme Arbeits- und Urlaubstage.<p/>" +
          "TimesBook")
          .then(() => {
            logger.info("E-mail with the decision for vacation request for '" + vacation.username + "' was sent");
            res.status(200).send({ success: "Vacation was successfuly updated" });
          })
          .catch((err) => {
            logger.error("Error while sending e-mail: " + err);
            res.status(500).send({ errorCode: 5002, message: "User cannot be invited. Error while sending e-mail." });
          });
    } catch (error) {
      logger.error("Error while accessing Database: " + error);
      res.status(500).send({ errorCode: 5001, message: error });
    }

});


/**
 *  Deletes a specific vacation
 */
router.delete("/:id", auth, async (req, res) => {
  logger.info("DELETE request on endpoint '/vacation/'. Id: " + req.params.id);

  try {
    const vacations = await Vacation.deleteOne({ username: req.requestingUser.username, _id: req.params.id });
    res.status(200).send({ success: "Vacation was successfuly deleted" });
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
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
    res.status(400).send({ errorCode: 4012, message: "The input contains not valid date" })
  } else {
    const start = moment.utc(req.body.from);
    const end = moment.utc(req.body.till);
    if (start.isAfter(end)) {
      res.status(400).send({ errorCode: 4013, message: "'from' can not be later as 'till'" })
    }
    else {
      try {
        if (req.requestingUser.username !== req.params.username)
          return res.status(403).send({ errorCode: 4010, message: "You have no permissions to change data for another user" });
        else {
          const vacations = await Vacation.find({
            username: req.requestingUser.username,
            status: { $ne: 'canceled' }
          });
          let periodOverlap = false;
          for (let i = 0; i < vacations.length; i++) {
            const element = vacations[i];
            const vacFrom = moment.utc(element.from);
            const vacTill = moment.utc(element.till);
            if (moment(start).isBetween(vacFrom, vacTill, undefined, '[]') ||
              moment(end).isBetween(vacFrom, vacTill, undefined, '[]')) {
              periodOverlap = true;
              break;
            }
          }
          if (periodOverlap)
            return res.status(400).send({ errorCode: 4015, message: "Overlapping of the periods" });
          else {
            const vacationEntry = new Vacation({
              username: req.params.username,
              from: req.body.from,
              till: req.body.till,
              status: "pending"
            });
            const savedVacationEntry = await vacationEntry.save();
            logger.debug("The vacation was sucessfully added: " + JSON.stringify(savedVacationEntry));

            const admin = await User.findOne({ organisation: req.requestingUser.organisation, role: 'admin' });
            mailer(
              req.params.username,
              "TimesBook: Urlaubsanfrage",
              "<p>Sehr geehrter Nutzer,</p>" +
              `<p>Sie haben eine Urlaubsanfrage vom Mitarbeiter ${req.requestingUser.name} erhalten. ` +
              `Sie können die Anfrage im Menü-Punkt 'Urlaubsanträge' bearbeiten.` +
              `<p><a href="${process.env.FRONTEND_URL}/VacationRequests">${process.env.FRONTEND_URL}/VacationRequests</a></p>` +
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
          }
        }
      } catch (error) {
        logger.error("Error while accessing Database: " + error);
        res.status(500).send({ errorCode: 5001, message: error });
      }
    }
  }
});



/**
 *  Gets vacations by username
 */
router.get("/remaining", auth, async (req, res) => {
  logger.info(`GET request on endpoint /vacation/remaining
    username=${req.query.username}`);

  try {
    if (req.requestingUser.username !== req.query.username && req.requestingUser.role !== 'admin')
      res.status(403).send({ errorCode: 4010, message: "You have no permissions to retrive data for another user" });
    else {
      const remVac = await remainingVacation(req.requestingUser);
      res.status(200).send({ success: { remainigVacation: remVac } });
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }

});


/**
 *  Gets all vacations filtering by username, from and till
 */
router.get("/", auth, async (req, res) => {
  logger.info(`GET request on endpoint /vacation/
    username=${req.query.username} from=${req.query.from}, till=${req.query.till}`);

  try {
    if (req.requestingUser.role !== 'admin' && req.requestingUser.username !== req.query.username)
      return res.status(403).send({ errorCode: 4010, message: "You have no permissions to retrive data for another user" });
    else {
      if ((!req.query.from && req.query.till) || (req.query.from && !req.query.till))
        res.status(400).send({ errorCode: 4026, message: "The query params 'from' and 'till' are wrong" })
      else {
        if (!moment(req.query.from).isValid() || !moment(req.query.till).isValid())
          res.status(400).send({ errorCode: 4012, message: "The input contains invalid date" })
        else {
          const start = moment.utc(req.query.from);
          const end = moment.utc(req.query.till);
          if (start.isAfter(end))
            res.status(400).send({ errorCode: 4013, message: "'from' can not be later as 'till'" })
          else {
            let queryUsers = { organization: req.requestingUser.organization }
            if (req.query.username)
              queryUsers.username = req.query.username;
            const users = await User.find(queryUsers);
            let query;
            if (req.query.from && req.query.till)
              query = {
                username: { $in: users.map(el => el.username) },
                $or: [{
                  $and: [
                    { from: { $gte: new Date(req.query.from) } },
                    { till: { $lte: new Date(req.query.till) } },
                  ],
                },
                {
                  $and: [
                    { from: { $gte: new Date(req.query.from) } },
                    { from: { $lte: new Date(req.query.till) } },
                  ],
                },
                {
                  $and: [
                    { till: { $gte: new Date(req.query.from) } },
                    { till: { $lte: new Date(req.query.till) } },
                  ],
                }],
              }
            else
              query = { username: { $in: users.map(el => el.username) } }

            const vacations = await Vacation.find(query);

            let objects = [];
            vacations.forEach(vac => {
              let name = users.find(element => element.username === vac.username).name
              let obj = {};
              obj.name = name;
              obj._id = vac._id;
              obj.username = vac.username;
              obj.from = vac.from;
              obj.till = vac.till;
              obj.status = vac.status
              objects.push(obj);
            })
            res.status(200).send({ success: objects });
          }
        }
      }
    }
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }

});

module.exports = router;
