const express = require("express");
const router = express.Router();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
let User = require("../models/user");
let Complaint = require("../models/complaint");
let ComplaintMapping = require("../models/complaint-mapping");
dotenv.config();
// Home Page - Dashboard
router.get("/", ensureAuthenticated, (req, res, next) => {
  res.render("index");
});

// Login Form
router.get("/login", (req, res, next) => {
  res.render("login");
});

// Register Form
router.get("/register", (req, res, next) => {
  res.render("register");
});

// Logout
router.get("/logout", ensureAuthenticated, (req, res, next) => {
  req.logout();
  req.flash("success_msg", "You are logged out");
  res.redirect("/login");
});

// Admin
router.get("/admin", ensureAuthenticated, (req, res, next) => {
  Complaint.getAllComplaints((err, complaints) => {
    if (err) throw err;

    User.getEngineer((err, engineer) => {
      if (err) throw err;

      res.render("admin/admin", {
        complaints: complaints,
        engineer: engineer,
      });
    });
  });
});

// Assign the Complaint to Engineer
router.post("/assign", (req, res, next) => {
  const complaintID = req.body.complaintID;
  const engineerName = req.body.engineerName;

  req.checkBody("complaintID", "Contact field is required").notEmpty();
  req.checkBody("engineerName", "Description field is required").notEmpty();

  let errors = req.validationErrors();

  if (errors) {
    res.render("admin/admin", {
      errors: errors,
    });
  } else {
    const newComplaintMapping = new ComplaintMapping({
      complaintID: complaintID,
      engineerName: engineerName,
    });

    ComplaintMapping.registerMapping(newComplaintMapping, (err, complaint) => {
      if (err) throw err;
      req.flash(
        "success_msg",
        "You have successfully assigned a complaint to Engineer"
      );
      res.redirect("/admin");
    });
  }
});

// Junior Eng
router.get("/jeng", ensureAuthenticated, async (req, res, next) => {
  const query = await ComplaintMapping.find({
    engineerName: req.username,
  });
  console.log(req.username);

  const data = await Promise.all(
    query.map(async (com) => {
      const result = await Complaint.findById(com.complaintID);
      const obj = result.toObject();
      const id = com._id;
      return { ...obj, id };
    })
  );
  console.log(data);
  const complinet = await Complaint.find();
  res.render("junior/junior", { complaints: data });
});

//Complaint
router.get("/complaint", ensureAuthenticated, (req, res, next) => {
  //console.log(req.session.passport.username);
  //console.log(user.name);
  console.log(req.user);
  res.render("complaint", {
    user: req.user,
  });
});

//Register a Complaint
router.post("/registerComplaint", (req, res, next) => {
  const name = req.body.name;
  const email = req.body.email;
  const contact = req.body.contact;
  const desc = req.body.desc;

  const postBody = req.body;
  console.log(postBody);

  req.checkBody("contact", "Contact field is required").notEmpty();
  req.checkBody("desc", "Description field is required").notEmpty();

  let errors = req.validationErrors();

  if (errors) {
    res.render("complaint", {
      errors: errors,
    });
  } else {
    const newComplaint = new Complaint({
      name: name,
      email: email,
      contact: contact,
      desc: desc,
    });

    Complaint.registerComplaint(newComplaint, (err, complaint) => {
      if (err) throw err;
      req.flash("success_msg", "You have successfully launched a complaint");
      res.redirect("/");
    });
  }
});

router.delete("/solved/:id", async (req, res) => {
  console.log(req.params.id);
  const data = await ComplaintMapping.findByIdAndDelete(req.params.id);
  const user = await Complaint.findById(data.complaintID);

  sendMail(user);
  await Complaint.findByIdAndDelete(data.complaintID);
  res.status(204).json({
    status: "succes",
    data: "data deleted Successfully",
  });
});
// Process Register
router.post("/register", (req, res, next) => {
  const name = req.body.name;
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const password2 = req.body.password2;
  const role = req.body.role;
  const phone = req.body.phone;

  req.checkBody("name", "Name field is required").notEmpty();
  req.checkBody("email", "Email field is required").notEmpty();
  req.checkBody("email", "Email must be a valid email address").isEmail();
  req.checkBody("username", "Username field is required").notEmpty();
  req.checkBody("password", "Password field is required").notEmpty();
  req
    .checkBody("password2", "Passwords do not match")
    .equals(req.body.password);
  req.checkBody("role", "Role option is required").notEmpty();

  let errors = req.validationErrors();

  if (errors) {
    res.render("register", {
      errors: errors,
    });
  } else {
    const newUser = new User({
      name: name,
      username: username,
      email: email,
      password: password,
      role: role,
      phone,
    });

    User.registerUser(newUser, (err, user) => {
      if (err) throw err;
      req.flash(
        "success_msg",
        "You are Successfully Registered and can Log in"
      );
      res.redirect("/login");
    });
  }
});

// Local Strategy
passport.use(
  new LocalStrategy((username, password, done) => {
    User.getUserByUsername(username, (err, user) => {
      if (err) throw err;
      if (!user) {
        return done(null, false, {
          message: "No user found",
        });
      }

      User.comparePassword(password, user.password, (err, isMatch) => {
        if (err) throw err;
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, {
            message: "Wrong Password",
          });
        }
      });
    });
  })
);

passport.serializeUser((user, done) => {
  var sessionUser = {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
  done(null, sessionUser);
});

passport.deserializeUser((id, done) => {
  User.getUserById(id, (err, sessionUser) => {
    done(err, sessionUser);
  });
});

// Login Processing
router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res, next) => {
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      if (req.user.role === "admin") {
        res.redirect("/admin");
      } else if (req.user.role === "jeng") {
        const username = req.user.username;

        res.redirect(`/jeng?username=${username}`);
      } else {
        res.redirect("/");
      }
    });
  }
);

// Access Control
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    req.username = req.query.username;
    return next();
  } else {
    req.flash("error_msg", "You are not Authorized to view this page");
    res.redirect("/login");
  }
}

function sendMail(user) {
  // Create a transporter using your Gmail account
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.user,
      pass: process.env.pass,
    },
  });

  // Define the email data
  console.log(user.email);
  const mailOptions = {
    from: "kavinskarasus@gmail.com",
    to: user.email,
    subject: "Complient Resolved",
    text: `${user.desc} reference id:  ${user._id}
    Thansk for Contacting us .`,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

router.post("/getComplinet", async (req, res) => {
  console.log(req.body);
  try {
    const getComplinet = await Complaint.find({ email: req.body.email });
    res.status(200).json({
      status: "true",
      data: getComplinet,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      err,
    });
  }
});
module.exports = router;
