const mongoose = require("mongoose");

const SickTimeSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  from: {
    type: Date,
    required: true,
  },
  till: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("SickTime", SickTimeSchema);
