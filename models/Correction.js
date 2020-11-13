const mongoose = require("mongoose");

const CorrectionSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("Corrections", CorrectionSchema);
