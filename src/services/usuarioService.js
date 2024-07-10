const { PrismaClient, Prisma } = require('@prisma/client');
const { hashPassword, comparePassword } = require('../utils/password');
const ErrorApp = require('../utils/error');
const { generateToken } = require('../utils/jwt');

/**
 * @param {String} usuario
 * @param {String} password
 * @returns 
 */
const authenticateUsuario = async ({ usuario, password } = {}) => {
    const prisma = new PrismaClient();

    try {
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    {usuario},
                    {email: usuario}
                ]
            },
            include: {
                rol: true
            }
        });

        if(!user){
            throw new ErrorApp('Error al autenticar usuario', 401);
        }

        const match = await comparePassword(password, user.password);

        if(!match){
            throw new ErrorApp('Error al autenticar usuario', 401);
        }

        const tokenPayload = {
            id: user.id,
            email: user.email,
            usuario: user.usuario,
            rol: user.rol.nombre
        }

        const token = generateToken(tokenPayload);

        return token;
    
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al autenticar usuario');
    } finally {
        prisma.$disconnect();
    }

}

module.exports = {
    authenticateUsuario
}