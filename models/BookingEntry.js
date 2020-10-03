const mongoose = require('mongoose');
mongoose.set('useCreateIndex', true);

const BookingEntrySchema = mongoose.Schema({

    username: {
        type: String,
        required: true
    },
    day: {
        type: Date,
        required: true,
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        required: true
    },
    pause: {
        type: String,
        required: true
    },
    activities: {
        type: String,
        dafault: ''
    },
})

// BookingEntrySchema.index({ username: 1, day: 1 }, { unique: true })
module.exports = mongoose.model('BookingEntries', BookingEntrySchema);