const moment = require("moment");
const getTargetWorkingModel = require("./getTargetWorkingModel");
const Vacation = require("../models/Vacation");
const SickTime = require("../models/SickTime");
const logger = require("../utils/logger");
const lodash = require("lodash");
const axios = require('axios');

/**
 * 
 */
const equals = function equals(prev, act) {
  let result = true;

  if ((!prev && !act))
    return true;

  if (
    (prev && !act) ||
    (!prev && act) ||
    prev['1'] !== act['1'] ||
    prev['2'] !== act['2'] ||
    prev['3'] !== act['3'] ||
    prev['4'] !== act['4'] ||
    prev['5'] !== act['5'] ||
    prev['6'] !== act['6']) {
    result = false;
  }

  return result;
}

/**
 * 
 */
const remainingVacation = async function getVacationFromUserRegistrationTillThisYear(user) {

  let vacationEntitlementTotal = 0;
  let takenVacationDays = 0;
  let countHolidays = 0

  // count vacation entitlement for each working day according working model
  const fromStr = moment(user.registrationDate).format('YYYY-MM-DD');
  let countVacationFrom = moment(fromStr);
  let till = moment(moment().year() + '-12-31');
  let actDay = moment(fromStr);
  prevDay = lodash.cloneDeep(actDay);
  prevWorkingModel = undefined;
  let vacationPerWorkingDay = 0;
  while (actDay <= till) {
    const targetWorkingModel = getTargetWorkingModel(user.workingModels, actDay.format('YYYY-MM-DD'));
    if (targetWorkingModel) {
      let targetDayHours = targetWorkingModel ? targetWorkingModel[actDay.day()] : 0;
      if (targetDayHours !== undefined && targetDayHours > 0) {
        // compute vacation per working day, if working model or year changed 
        if (!equals(prevWorkingModel, targetWorkingModel) || actDay.year() != prevDay.year())
          vacationPerWorkingDay = getVacationPerWorkingDayInYear(targetWorkingModel, actDay.format('YYYY'));
        vacationEntitlementTotal = vacationEntitlementTotal + vacationPerWorkingDay

      }
    }
    prevWorkingModel = lodash.cloneDeep(targetWorkingModel);
    prevDay = lodash.cloneDeep(actDay);
    actDay = actDay.add(moment.duration({ 'days': 1 }));
  }

  // count WHOLE taken vacation days from registration until end of the actual year
  try {
    const vacations = await Vacation.find({
      username: user.username,
      status: "approved"
    });

    for (let index = 0; index < vacations.length; index++) {

      const element = vacations[index];
      const vacStart = moment(element.from);
      const vacEnd = moment(element.till);

      let vacActDay = moment(element.from)
      let holidays = await getHolidajys(vacActDay.year());
      let sickTimes = await getSickTimes(vacActDay.year(), user);
      prevDay = lodash.cloneDeep(vacActDay);
      while (vacActDay.isSameOrBefore(vacEnd, 'day')) {
        if (vacActDay.isBetween(countVacationFrom, till, 'day', '[]')) {
          const targetWorkingModel = getTargetWorkingModel(user.workingModels, vacActDay.format('YYYY-MM-DD'));
          let targetDayHours = targetWorkingModel ? targetWorkingModel[vacActDay.day()] : 0;
          if (targetDayHours !== undefined && targetDayHours > 0) {
            takenVacationDays++;

            if (vacActDay.year() != prevDay.year()) {
              holidays = await getHolidajys(vacActDay.year());
              sickTimes = await getSickTimes(vacActDay.year(), user);
            }
            if (isSickDay(sickTimes, vacActDay) || isHoliday(holidays, vacActDay))
              countHolidays++;
          }
        }
        prevDay = lodash.cloneDeep(vacActDay);
        vacActDay = vacActDay.add(moment.duration({ 'days': 1 }));
      }
    }
  } catch (error) {
    throw new Error("Unable to compute overtime " + error)
  }

  // logger.debug("vacationEntitlementTotal: " + vacationEntitlementTotal)
  // logger.debug("takenVacationDays: " + takenVacationDays)
  // logger.debug("countHolidays: " + countHolidays)

  return vacationEntitlementTotal - takenVacationDays + countHolidays;
}


/**
 * 
 * @param {*} sickTimes 
 * @param {*} vacActDay 
 */
function isSickDay(sickTimes, vacActDay) {
  let result = false
  if (sickTimes) {
    for (let index = 0; index < sickTimes.length; index++) {
      const sickTime = sickTimes[index];
      if (vacActDay.isBetween(sickTime.from, sickTime.till, 'day', '[]'))
        result = true;
    }
  }
  return result;
}

/**
 * 
 * @param {*} holidays 
 * @param {*} vacActDay 
 */
function isHoliday(holidays, vacActDay) {
  let result = false
  if (holidays)
    for (const key in holidays['NATIONAL']) {
      if (holidays['NATIONAL'].hasOwnProperty(key)) {
        const element = holidays['NATIONAL'][key];
        if (vacActDay.isSame(element.datum, 'day'))
          result = true;
      }
    }
  return result;
}


/**
 * 
 * @param {*} workingModel 
 * @param {*} targetYearNumber 
 */
function getVacationPerWorkingDayInYear(workingModel, targetYearNumber) {

  let actDay = moment(targetYearNumber + "-01-01");
  const end = moment(targetYearNumber + "-12-31");

  // count working days in year
  let workingDays = 0;
  while (actDay.isSameOrBefore(end)) {
    let targetDayHours = workingModel ? workingModel[actDay.day()] : 0;
    if (targetDayHours !== undefined && targetDayHours > 0)
      workingDays = workingDays + 1;

    actDay = actDay.add(moment.duration({ 'days': 1 }));
  }
  return workingModel.vacationEntitlement / workingDays;
}

/**
 * 
 * @param {*} year 
 */
async function getHolidajys(year) {
  const errorMsg = "Can't get holidays.";
  const URL = `${process.env.HOLIDAY_API_URL}/?jahr=${year}`;
  logger.info(URL);
  const holidays = await axios.get(`${process.env.HOLIDAY_API_URL}/?jahr=${year}`)
    .then((response) => response.data)
    .catch((err) => {
      logger.error(errorMsg + " No response from server.", err)
    });
  return holidays;
}

/**
 * 
 * @param {*} year 
 * @param {*} user 
 */
async function getSickTimes(year, user) {
  const from = year + "-01-01";
  const till = year + "-12-31"
  try {
    const sickTimes = await SickTime.find({
      username: user.username,
      $or: [{
        $and: [
          { from: { $gte: new Date(from) } },
          { till: { $lte: new Date(till) } },
        ],
      },
      {
        $and: [
          { from: { $gte: new Date(from) } },
          { from: { $lte: new Date(till) } },
        ],
      },
      {
        $and: [
          { till: { $gte: new Date(from) } },
          { till: { $lte: new Date(till) } },
        ],
      }],
    });
    return sickTimes;
  } catch (error) {
    logger.error("Error while accessing Database: " + error);
    res.status(500).send({ errorCode: 5001, message: error });
  }
}


module.exports = remainingVacation;
