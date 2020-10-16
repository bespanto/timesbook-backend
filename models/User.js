const mongoose = require("mongoose");
mongoose.set("useCreateIndex", true);

const UserSchema = mongoose.Schema({
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
  registrationDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

UserSchema.index({ username: 1 }, { unique: true });
module.exports = mongoose.model("Users", UserSchema);
