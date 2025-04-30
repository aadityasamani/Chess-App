const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: String,
    email: String,
    password: String,
    profilepic: {
        type:String,
        default: "default.jpg"
    },
});

module.exports = mongoose.model('User', userSchema);