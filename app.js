const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors')
require('dotenv/config');
const bookingEntriesRoute = require('./routes/bookingEntries')
const authRoute = require('./routes/auth')
const userRoute = require('./routes/user')
const vacationsRoute = require('./routes/vacations')


//Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/api/bookingEntries', bookingEntriesRoute);
app.use('/api/user', userRoute);
app.use('/api/auth', authRoute);
app.use('/api/vacation', vacationsRoute);

app.get('/', (req, res) => {
    res.send('We are on home');
})

mongoose.connect(
    process.env.DB_CONNECTION,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
    () => console.log('Connected to DB'))

app.listen(8000)