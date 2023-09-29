const mongoose = require("mongoose");
const dbconnect = require("../db");

//Call the db to connect the mongo db
dbconnect();

// Complaint Schema
const ComplaintSchema = mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  contact: {
    type: String,
  },
  desc: {
    type: String,
  },
  phone: {
    type: String,
    max: 10,
  },
  status: {
    type: String,
    default: "Pending",
  },
});

const Complaint = (module.exports = mongoose.model(
  "Complaint",
  ComplaintSchema
));

module.exports.registerComplaint = function (newComplaint, callback) {
  newComplaint.save(callback);
};

module.exports.getAllComplaints = function (callback) {
  Complaint.find(callback);
};
