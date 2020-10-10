const mongoose = require("mongoose");

const BookingEntrySchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  day: {
    type: Date,
    required: true,
  },
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
    required: true,
  },
  pause: {
    type: String,
    required: true,
  },
  activities: {
    type: String,
    dafault: "",
  },
});

module.exports = mongoose.model("BookingEntries", BookingEntrySchema);
