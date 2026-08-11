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

// Los cronjobs SIFEN sólo corren en producción. Si ENTORNO es 'desa' o no está definido, no se registran.
if (process.env.ENTORNO === 'prod') {
    cronJobs()
} else {
    console.log(`Cronjobs deshabilitados (ENTORNO=${process.env.ENTORNO || 'no definido'})`)
}

app.use('/public', express.static(path.join(__dirname, '..', 'public')))
app.use(routes)

app.listen(process.env.PORT, ()=> {
    console.log(`Server running on port ${process.env.PORT}`)
});