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

const register = async ({ nombres, apellidos, email, usuario, password, empresaId, rolId } = {}) => {
    const prisma = new PrismaClient();

    try {
        //Verificar usuario existente
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    {usuario},
                    {email: usuario}
                ]
            }
        });

        if(user){
            const message = user.usuario == usuario ? `Usuario ${usuario} ya existe` : `El email ${email} ya existe`;
            throw new ErrorApp(message, 400);
        }

        //Verificar si existe rol y empresa
        const rol = await prisma.rol.findFirst({
            where: {
                id: rolId
            }
        });

        if(!rol) {
            throw new ErrorApp(`Rol no existe`, 400);
        }

        const empresa = await prisma.empresa.findFirst({
            where: {
                id: empresaId
            }
        });

        if(!empresa){
            throw new ErrorApp(`Empresa no existe`, 400);
        }

        const hashedPassword = await hashPassword(password);

        const newUser = await prisma.usuario.create({
            data: {
                nombres,
                apellidos,
                email,
                usuario,
                password: hashedPassword,
                rol_id: rolId,
                empresa_id: empresaId
            },
            
        });

        delete newUser['password'];

        return newUser;

    } catch (error) {

        ErrorApp.handleServiceError(error, 'Error al crear usuario');
    }finally{
        prisma.$disconnect();
    }
}

module.exports = {
    authenticateUsuario,
    register
}