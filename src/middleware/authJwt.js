const ErrorApp = require("../utils/error");
const { verifyToken } = require("../utils/jwt");
const Response = require("../utils/response");
const prisma = require("../prisma/cliente");

const authJwt = (roles) => {
    return async (req, res, next) => {
        if(typeof roles === 'string') roles = [roles];

        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers['x-api-key'];

        let token;
        let esApiKey = false;

        if(authHeader && authHeader.startsWith('Bearer ')){
            token = authHeader.split(' ')[1];
        } else if(apiKeyHeader){
            token = apiKeyHeader;
            esApiKey = true;
        } else {
            return res.status(401).send(Response.error('Token no proporcionado o malformado', 401));
        }

        try {
            const decoded = verifyToken(token);

            // El api key es un JWT sin expiración persistido en usuario.api_key. Además de
            // verificar la firma, debe coincidir con el valor guardado para permitir revocación/rotación.
            if(esApiKey){
                const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } });
                if(!usuario || !usuario.activo || usuario.api_key !== token){
                    throw new ErrorApp('API key inválida', 401);
                }
            }

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