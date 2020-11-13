const moment = require("moment");
const BookingEntry = require("../models/BookingEntry");
const Correction = require("../models/Correction");

const flextime = async function getFlextimeFromUserRegistration(user) {

    let overtimeAsMin = 0;
    let shoudToBeHours = 0;
    let totalWorkingTime = 0;
    let totalCorrections = 0;
    
    const fromStr = moment(user.registrationDate).format('YYYY-MM-DD');
    let from = moment(fromStr);
    let till = moment();
    let actDay = moment(fromStr);
  
    while (actDay < till) {
      const targetWorkingModel = getTargetWorkingModel(user.workingModels, actDay.format('YYYY-MM-DD'));
      let targetDayHours = targetWorkingModel ? targetWorkingModel[actDay.day()] : 0;
      shoudToBeHours = shoudToBeHours + (targetDayHours === undefined ? 0 : targetDayHours);
      actDay = actDay.add(moment.duration({'days' : 1}));
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
      corrections.forEach((el) =>{
        totalCorrections = totalCorrections + el.value;
      })

    } catch (error) {
      throw new Error("Unable to compute overtime " + error)
    }
    return overtimeAsMin = totalWorkingTime - shoudToBeHours*60 + totalCorrections;
  }
  
  
  function getTargetWorkingModel(models, startTime) {
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

module.exports = flextime;
