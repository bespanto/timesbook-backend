
const SickTime = require("../models/SickTime");
const Vacation = require("../models/Vacation");
const logger = require("../utils/logger");
const axios = require('axios');
const moment = require("moment");

/**
 * 
 * @param {*} models 
 * @param {*} startTime 
 */
const getTargetWorkingModel = (models, startTime) => {

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

/**
 * 
 * @param {*} vacations 
 * @param {*} day 
 */
const isVacationDay = (vacations, day) => {
  let result = false
  if (vacations) {
    for (let index = 0; index < vacations.length; index++) {
      const vacation = vacations[index];
      if (day.isBetween(vacation.from, vacation.till, 'day', '[]'))
        result = true;
    }
  }
  return result;
}

/**
 * 
 * @param {*} sickTimes 
 * @param {*} day 
 */
const isSickDay = (sickTimes, day) => {
  let result = false
  if (sickTimes) {
    for (let index = 0; index < sickTimes.length; index++) {
      const sickTime = sickTimes[index];
      if (day.isBetween(sickTime.from, sickTime.till, 'day', '[]'))
        result = true;
    }
  }
  return result;
}

/**
 * 
 * @param {*} holidays 
 * @param {*} day 
 */
const isHoliday = (holidays, day) => {
  let result = false
  if (holidays)
    for (const key in holidays['NATIONAL']) {
      if (holidays['NATIONAL'].hasOwnProperty(key)) {
        const element = holidays['NATIONAL'][key];
        if (day.isSame(element.datum, 'day'))
          result = true;
      }
    }
  return result;
}

/**
 * 
 * @param {*} year 
 */
const getHolidays = async (year) => {
  const errorMsg = "Can't get holidays.";
  const URL = `${process.env.HOLIDAY_API_URL}/?jahr=${year}`;
  logger.info(URL);
  const holidays = await axios.get(`${process.env.HOLIDAY_API_URL}/?jahr=${year}`)
    .then((response) => response.data)
    .catch((err) => {
      throw new Error(errorMsg + " No response from server.", err)
    });
  return holidays;
}

/**
 * 
 * @param {*} year 
 * @param {*} user 
 */
const getSickTimes = async (year, user) => {
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
    throw new Error("Error while getting sick times: " + error);
  }
}


const getVacations = async (from, till, username) => {
  try {
    const vacations = await Vacation.find({
      username: username,
      status: 'approved',
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
    return vacations;

  } catch (error) {
    throw new Error("Error while gettin vacations: " + error);
  }
}




exports.isSickDay = isSickDay;
exports.isHoliday = isHoliday;
exports.isVacationDay = isVacationDay;
exports.getHolidays = getHolidays;
exports.getSickTimes = getSickTimes;
exports.getTargetWorkingModel = getTargetWorkingModel;
exports.getVacations = getVacations;