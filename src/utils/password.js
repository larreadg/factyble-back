const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const hashPassword = (pw) => {
    return bcrypt.hash(pw, SALT_ROUNDS)
}

const comparePassword = async (pw, hash) => {
    return bcrypt.compare(pw, hash);
}

module.exports = {
    hashPassword,
    comparePassword
}