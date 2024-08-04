require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const routes = require('./routes');
const generarPdf = require('./utils/generarPdf');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended : false }));

app.use(routes);

app.listen(process.env.PORT, ()=> {
    console.log(`Server running on port ${process.env.PORT}`);
});