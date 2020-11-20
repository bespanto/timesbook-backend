const moment = require("moment");
const lodash = require("lodash");
const {
  getHolidays,
  getSickTimes,
  isHoliday,
  isSickDay,
  isVacationDay,
  getVacations,
  getTargetWorkingModel } = require("./TimeIntervalUtils");
const BookingEntry = require("../models/BookingEntry");
const Correction = require("../models/Correction");
const logger = require("../utils/logger");

const flextime = async function getFlextimeFromUserRegistration(user) {
  const startCompTime = moment();
  let countTotalHoliday = 0;

  let overtimeAsMin = 0;
  let shoudToBeHours = 0;
  let totalWorkingTime = 0;
  let totalCorrections = 0;
  let excusedAbsenceHours = 0

  const fromStr = moment(user.registrationDate).format('YYYY-MM-DD');
  let from = moment(fromStr);
  let till = moment();
  let actDay = moment(fromStr);

  prevDay = lodash.cloneDeep(actDay);
  let holidays = await getHolidays(actDay.year());
  let sickTimes = await getSickTimes(from.format('YYYY-MM-DD'), till.format('YYYY-MM-DD'), user);
  let vacations = await getVacations(from.format('YYYY-MM-DD'), till.format('YYYY-MM-DD'), user);
  // let sickTimes = await getSickTimes(actDay.year() + "-01-01", actDay.year() + "-12-31", user);
  // let vacations = await getVacations(actDay.year() + "-01-01", actDay.year() + "-12-31", user);
  while (actDay.isSameOrBefore(till, 'day')) {
    const targetWorkingModel = getTargetWorkingModel(user.workingModels, actDay.format('YYYY-MM-DD'));
    let targetDayHours = targetWorkingModel ? targetWorkingModel[actDay.day()] : 0;


    if (actDay.year() != prevDay.year()) {
      const startHolidays = moment();
      holidays = await getHolidays(actDay.year());
      countTotalHoliday = countTotalHoliday + moment().diff(startHolidays);
      // sickTimes = await getSickTimes(actDay.year() + "-01-01", actDay.year() + "-12-31", user);
      // vacations = await getVacations(actDay.year() + "-01-01", actDay.year() + "-12-31", user);
    }
    if (!isSickDay(sickTimes, actDay) && !isHoliday(holidays, actDay) && !isVacationDay(vacations, actDay))
      shoudToBeHours = shoudToBeHours + (targetDayHours === undefined ? 0 : targetDayHours);

    prevDay = lodash.cloneDeep(actDay);
    actDay = actDay.add(moment.duration({ 'days': 1 }));
  }
  try {
    const bookingEntries = await BookingEntry.find({
      username: user.username,
      $and: [
        { day: { $gte: from.toDate() } },
        { day: { $lte: till.toDate() } },
      ],
    });
    if (bookingEntries) {
      bookingEntries.forEach((element) => {
        const workingTime = moment.duration(moment(element.end).diff(moment(element.start))).asMinutes();
        const pause = moment.duration(element.pause).asMinutes();
        totalWorkingTime = totalWorkingTime + workingTime - pause;
      })
    }
    const corrections = await Correction.find({ username: user.username, type: "flextime" });
    corrections.forEach((el) => {
      totalCorrections = totalCorrections + el.value;
    })

  } catch (error) {
    throw new Error("Unable to compute overtime " + error)
  }
  const endCompTime = moment();

  logger.info("Computing of flextime: " + endCompTime.diff(startCompTime));
  logger.info("Time for requesting holidays: " + countTotalHoliday);
  return overtimeAsMin = totalWorkingTime - shoudToBeHours * 60 + totalCorrections;
}

module.exports = flextime;
