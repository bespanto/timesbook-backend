const mongoose = require("mongoose");

const VacationSchema = mongoose.Schema({
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
  status: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Vacations", VacationSchema);
