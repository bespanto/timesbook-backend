const mongoose = require("mongoose");
mongoose.set("useCreateIndex", true);


const workingModel = mongoose.Schema({
  1: { // monday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  2: { //thuesday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  3: { //wednesday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  4: { //thursday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  5: { //friday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  6: { //saturday
    type: Number,
    required: true,
    min: [0, 'Min. working hours must be 0'],
    max: [10, 'Max. working hours must be 12'],
  },
  validFrom: {
    type: Date,
    required: true,
  },
  vacationEntitlement: {
    type: Number,
    required: true,
  },
})
// workingModel.index({ validFrom: -1 }, { unique: false });
mongoose.model("WorkingModel", workingModel);

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    min: 6,
    max: 255,
  },
  username: {
    type: String,
    required: true,
    min: 6,
    max: 255,
  },
  password: {
    type: String,
    min: 6,
    max: 255,
  },
  role: {
    type: String,
    required: true,
  },
  organization: {
    type: String,
    required: true,
  },
  registrationKey: {
    type: String,
  },
  status: {
    type: String,
  },
  registrationDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  workingModels: [workingModel]
});
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ "workingModels.validFrom": -1 }, { unique: false });


module.exports = mongoose.model("Users", userSchema);
