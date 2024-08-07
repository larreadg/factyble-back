require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
const routes = require('./routes')
const path = require('path')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended : false }))

app.use('/public', express.static(path.join(__dirname, '..', 'public')))
app.use(routes)

app.listen(process.env.PORT, ()=> {
    console.log(`Server running on port ${process.env.PORT}`)
})