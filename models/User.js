const mongoose = require('mongoose');
mongoose.set('useCreateIndex', true);

const userSchema = mongoose.Schema({

    name: {
        type: String,
        required: true,
        min: 6,
        max: 255
    },
    username: {
        type: String,
        required: true,
        min: 6,
        max: 255
    },
    password: {
        type: String,
        required: true,
        min: 6,
        max: 255
    },
    role: {
        type: String,
        required: true,
        default: 'admin'
    },
    organization: {
        type: String,
        required: true,
    },
    registrationKey: {
        type: String,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
})

module.exports = mongoose.model('Users', userSchema);