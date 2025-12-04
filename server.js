const HTTP_PORT = process.env.PORT || 8080;

const express = require("express");
const app = express();

app.use(express.static(__dirname + "/public"));

app.set("view engine", "ejs");

app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: true }));

// Sessions
const session = require("express-session");
require("dotenv").config();
const mongoose = require("mongoose");

app.use(session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890",
    resave: false,
    saveUninitialized: true,
}));

// Static files (CSS, images)

// ---------------------
// Mongo Schemas
// ---------------------
const usersSchema = new mongoose.Schema({
    email: String,
    password: String
});
const Users = mongoose.model("users", usersSchema);

const carsSchema = new mongoose.Schema({
    model: String,
    imageUrl: String,
    returnDate: String,
    rentedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
});
const Cars = mongoose.model("cars", carsSchema);

// ---------------------
// Authorization middleware
// ---------------------
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/");
    }
    next();
}

// ---------------------
// Routes
// ---------------------

// Login page
app.get("/", (req, res) => {
    res.render("login", { error: null });
});

// Login handler
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render("login", { error: "Email and password are required." });
    }

    try {
        let user = await Users.findOne({ email });

        if (user) {
            if (user.password === password) {
                req.session.userId = user._id;
                return res.redirect("/cars");
            } else {
                return res.render("login", { error: "Incorrect password. Please try again." });
            }
        } else {
            // Create account automatically
            user = new Users({ email, password });
            await user.save();
            req.session.userId = user._id;
            return res.redirect("/cars");
        }

    } catch (err) {
        console.log(err);
        return res.render("login", { error: "Server error. Try again." });
    }
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// Car list
app.get("/cars", requireLogin, async (req, res) => {
    try {
        const allCars = await Cars.find().lean();
        res.render("cars", { cars: allCars, session: req.session });
    } catch (err) {
        console.log(err);
        res.render("cars", { cars: [], session: req.session });
    }
});

// Booking form
app.get("/book/:id", requireLogin, async (req, res) => {
    try {
        const car = await Cars.findById(req.params.id).lean();
        res.render("bookingForm", { car });
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// Booking submit
app.post("/book", requireLogin, async (req, res) => {
    const { carId, returnDate } = req.body;

    try {
        await Cars.findByIdAndUpdate(carId, {
            rentedBy: req.session.userId,
            returnDate
        });
        res.redirect("/cars");
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// Return a car
app.post("/return", requireLogin, async (req, res) => {
    const { carId } = req.body;

    try {
        await Cars.findByIdAndUpdate(carId, {
            rentedBy: null,
            returnDate: ""
        });
        res.redirect("/cars");
    } catch (err) {
        console.log(err);
        res.redirect("/cars");
    }
});

// ---------------------
// Start server
// ---------------------
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("SUCCESS connecting to MongoDB");

        app.listen(HTTP_PORT, () => {
            console.log(`Server running at http://localhost:${HTTP_PORT}`);
        });

    } catch (err) {
        console.log("ERROR connecting to MongoDB");
        console.log(err);
    }
}

startServer();
