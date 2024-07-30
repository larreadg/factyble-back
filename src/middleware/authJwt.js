const ErrorApp = require("../utils/error");
const { verifyToken } = require("../utils/jwt");
const Response = require("../utils/response");

const authJwt = (roles) => {
    return (req, res, next) => {
        if(typeof roles === 'string') roles = [roles];

        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).send(Response.error('Token no proporcionado o malformado', 401));
        }

        const token = authHeader.split(' ')[1]

        try {
            const decoded = verifyToken(token);
            req.usuario = decoded;
            
            if(roles && (!req.usuario || !req.usuario.roles.every(rol => roles.includes(rol)))){
                throw new ErrorApp('Permiso denegado', 403);
            }
            
            next()
        } catch (error) {
            const { code, message } = ErrorApp.handleControllerError(error, 'Error al verificar token');
            return res.status(code).send(Response.error(message, code));
        }

    }
}

module.exports = {
    authJwt
};