const moment = require("moment");
const getTargetWorkingModel = require("./getTargetWorkingModel");
const Vacation = require("../models/Vacation");
const logger = require("../utils/logger");

/**
 * 
 */
const remainingVacation = async function getVacationFromUserRegistrationTillThisYear(user) {

  let vacationEntitlementTotal = 0;
  let takenVacationDays = 0;

  // count vacation entitlement for each working day according working model
  const fromStr = moment(user.registrationDate).format('YYYY-MM-DD');
  let countVacationFrom = moment(fromStr);
  let till = moment(moment().year() + '-12-31');
  let actDay = moment(fromStr);
  while (actDay <= till) {


    const targetWorkingModel = getTargetWorkingModel(user.workingModels, actDay.format('YYYY-MM-DD'));
    if (targetWorkingModel) {
      let targetDayHours = targetWorkingModel ? targetWorkingModel[actDay.day()] : 0;
      if (targetDayHours !== undefined && targetDayHours > 0) {
        vacationEntitlementTotal = vacationEntitlementTotal + getVacationPerWorkingDayInYear(targetWorkingModel, actDay.format('YYYY'));
      }
    }

    actDay = actDay.add(moment.duration({ 'days': 1 }));
  }

  // count WHOLE vacation days from registration until end of the actual year
  try {
    const vacations = await Vacation.find({
      username: user.username,
      status: "approved"
    });
    vacations.forEach((element) => {
      const vacStart = moment(element.from);
      const vacEnd = moment(element.till);

      let vacActDay = moment(element.from)
      while (vacActDay.isSameOrBefore(vacEnd)) {
        if (vacActDay.isBetween(countVacationFrom, till, undefined, '[]')) {
          const targetWorkingModel = getTargetWorkingModel(user.workingModels, vacActDay.format('YYYY-MM-DD'));
          let targetDayHours = targetWorkingModel ? targetWorkingModel[vacActDay.day()] : 0;
          if (targetDayHours !== undefined && targetDayHours > 0)
            takenVacationDays++;
        }
        vacActDay = vacActDay.add(moment.duration({ 'days': 1 }));
      }
    })


  } catch (error) {
    throw new Error("Unable to compute overtime " + error)
  }

  return vacationEntitlementTotal - takenVacationDays;
}

/**
 * 
 */
function getVacationPerWorkingDayInYear(workingModel, targetYearNumber) {

  // console.log("Rechnet getVacationPerWorkingDayInYear")

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
  // console.log("Rechnet VacationPerWorkingDayInYear: " + workingModel.vacationEntitlement / workingDays)
  return workingModel.vacationEntitlement / workingDays;
}



module.exports = remainingVacation;
