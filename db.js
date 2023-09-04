const { request } = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
function connect() {
  mongoose.connect(process.env.DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

module.exports = connect;
