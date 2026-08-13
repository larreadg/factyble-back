
const jwt = require('jsonwebtoken');
const ErrorApp = require('./error');

const generateToken = (payload, { sinExpiracion = false } = {}) => {
    const opciones = sinExpiracion ? {} : { expiresIn: process.env.JWT_EXPIRES_IN };
    return jwt.sign(payload, process.env.JWT_SECRET, opciones);
}

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new ErrorApp('Token inválido', 401);
    }
}

module.exports = {
    generateToken,
    verifyToken
}