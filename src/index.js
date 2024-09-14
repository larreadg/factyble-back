require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
const routes = require('./routes')
const path = require('path')
const cronJobs = require('./services/cronJobs')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended : false }))

// cronJobs()

app.use('/public', express.static(path.join(__dirname, '..', 'public')))
app.use(routes)

app.listen(process.env.PORT, ()=> {
    console.log(`Server running on port ${process.env.PORT}`)
});

const { checkFacturaStatus } = require('./services/facturaService');
(
    async()=>{
        checkFacturaStatus();
    }
)()