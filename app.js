require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
// const ejs = require('ejs')
const mongoose = require('mongoose')
// const bcrypt = require('bcrypt')
// const saltRounds = Number(process.env.SALT_ROUNDS)
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate')

const app = express()

app.use(express.static('public'))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.set('trust proxy', 1)

app.use(session({
  secret: 'Thisisourlittlesecret.',
  resave: false,
  saveUninitialized: true
  // cookie: { secure: true }
}))

app.use(passport.initialize())
app.use(passport.session())

// Connect to DB
mongoose.connect('mongodb://localhost:27017/userDB', { useUnifiedTopology: true, useNewUrlParser: true })
mongoose.set('useCreateIndex', true)

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String },
  password: { type: String },
  googleId: { type: String },
  secret: { type: String }
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

// User Model
const User = mongoose.model('User', userSchema)

passport.use(User.createStrategy())

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user)
  })
})

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/secrets',
  userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
},
function (accessToken, refreshToken, profile, cb) {
  console.log(profile)
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user)
  })
}
))

// home page route
app.get('/', function (req, res) {
  res.render('home')
})

// login via google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }))

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets')
  })

// login page route
app.get('/login', function (req, res) {
  res.render('login')
})

// register page route
app.get('/register', function (req, res) {
  res.render('register')
})

// secrets page route
app.get('/secrets', function (req, res) {
  User.find({ secret: { $ne: null } }, function (err, foundUsers) {
    if (err) {
      console.log(err)
    } else {
      if (foundUsers) {
        res.render('secrets', { usersWithSecret: foundUsers })
      }
    }
  })
})

app.get('/submit', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('submit')
  } else {
    res.redirect('/login')
  }
})

app.post('/submit', function (req, res) {
  const submittedSecret = req.body.secret
  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err)
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret
        foundUser.save(function () {
          res.redirect('/secrets')
        })
      }
    }
  })
})

// logout page route
app.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

// register post route - New User Registration
app.post('/register', function (req, res) {
  User.register({ username: req.body.username }, req.body.password, function (err, user) {
    if (err) {
      console.log(err)
      res.redirect('/register')
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/secrets')
      })
    }
  })
})

// login post route - User Login
app.post('/login', function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  })

  req.login(user, function (err) {
    if (err) {
      console.log(err)
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/secrets')
      })
    }
  })
})

app.listen(3000, function () {
  console.log('Server has started Successfully')
})
