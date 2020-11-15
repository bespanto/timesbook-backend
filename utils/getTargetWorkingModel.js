const moment = require("moment");

const getTargetWorkingModel = function getTargetWorkingModel(models, startTime) {

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

module.exports = getTargetWorkingModel;
