const HTTP_PORT = process.env.PORT || 8080;

const express = require("express");
const app = express();
app.set("view engine", "ejs");      // EJS templates
app.use(express.urlencoded({ extended: true })); // form parsing

// setup sessions
const session = require('express-session');
app.use(session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890",
    resave: false,
    saveUninitialized: true
}));

require("dotenv").config();
const mongoose = require('mongoose');

// serve static files (CSS, images)
app.use(express.static("public"));

// --- MongoDB Schemas ---
const usersSchema = new mongoose.Schema({
    email: String,
    password: String
});
const users = mongoose.model("users", usersSchema);

const carsSchema = new mongoose.Schema({
    model: String,
    imageUrl: String,
    returnDate: String,
    rentedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
});
const cars = mongoose.model("cars", carsSchema);

// --- Middleware for authorization ---
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/"); // not logged in → go to login page
    }
    next();
};

// --- Routes ---

// Login page (anyone can view)
app.get("/", (req, res) => {
    res.render("login.ejs");
});

// Login form submission
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render("login", { error: "Email and password are required." });
    }

    try {
        let user = await users.findOne({ email });
        if (user) {
            if (user.password === password) {
                req.session.userId = user._id;
                return res.redirect("/cars");
            } else {
                return res.render("login", { error: "Incorrect password. Please try again." });
            }
        } else {
            // Create new user if not found
            user = new users({ email, password });
            await user.save();
            req.session.userId = user._id;
            return res.redirect("/cars");
        }
    } catch (err) {
        console.log(err);
        res.send("An error occurred. Please try again.");
    }
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) console.log(err);
        res.redirect("/");
    });
});

// Cars list page (only logged-in users)
app.get("/cars", requireLogin, async (req, res) => {
    try {
        const allCars = await cars.find().lean();
        res.render("cars", { cars: allCars, session: req.session });
    } catch (err) {
        console.log(err);
        res.render("cars", { cars: [], session: req.session });
    }
});

// Booking page (only logged-in users)
app.get("/book/:id", requireLogin, async (req, res) => {
    try {
        const car = await cars.findById(req.params.id).lean();
        res.render("bookingForm", { car });
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// Booking submission
app.post("/book", requireLogin, async (req, res) => {
    const { carId, returnDate } = req.body;
    try {
        await cars.findByIdAndUpdate(carId, {
            rentedBy: req.session.userId,
            returnDate
        });
        res.redirect("/cars");
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// Return car (only logged-in users)
app.post("/return", requireLogin, async (req, res) => {
    const { carId } = req.body;
    try {
        await cars.findByIdAndUpdate(carId, { rentedBy: null, returnDate: "" });
        res.redirect("/cars");
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// --- Start server ---
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("SUCCESS connecting to MONGO database");
        console.log("STARTING Express web server");

        app.listen(HTTP_PORT, () => {
            console.log(`Server listening on http://localhost:${HTTP_PORT}`);
        });
    } catch (err) {
        console.log("ERROR: connecting to MONGO database");
        console.log(err);
        console.log("Please resolve these errors and try again.");
    }
}

startServer();
