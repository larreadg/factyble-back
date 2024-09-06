const { hashPassword, comparePassword } = require('../utils/password');
const ErrorApp = require('../utils/error');
const { generateToken } = require('../utils/jwt');
const dayjs = require('dayjs');
const prisma = require('../prisma/cliente');

/**
 * @param {String} usuario
 * @param {String} password
 * @returns 
 */
const authenticateUsuario = async ({ usuario, password, captcha } = {}) => {

    try {

        const captchaCheck = await prisma.captcha.findFirst({
            where: {
                captcha,
                fecha_expiracion: {
                    gt: dayjs().toDate()
                }
            }
        })

        if(!captchaCheck){
            throw new ErrorApp('Captcha inválida o expirada', 401);
        }

        await prisma.captcha.deleteMany({
            where: {
                captcha
            }
        })

        const user = await prisma.usuario.findFirst({
            where: {
                email: usuario
            },
            include: {
                roles: {
                    include: {
                        rol: true
                    }
                },
                empresa: true
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
            documento: user.documento,
            telefono: user.telefono,
            empresaId: user.empresa_id,
            empresaNombre: user.empresa.nombre_empresa,
            empresaRuc: user.empresa.ruc,
            roles: user.roles.map(r => r.rol.nombre)
        }

        const token = generateToken(tokenPayload);

        return token;
    
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al autenticar usuario');
    }

}

const register = async ({ nombres, apellidos, email, documento, telefono, password, empresaId, roles } = {}) => {

    try {
        //Verificar usuario existente
        const user = await prisma.usuario.findFirst({
            where: {email}
        });

        if(user){
            throw new ErrorApp('El email ya está en uso', 400);
        }

        //Verificar si existe rol y empresa
        const rolesData = await prisma.rol.findMany({
            where: {
                id: {in: roles}
            }
        });

        if(!rolesData || rolesData.length != roles.length) {
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
                documento,
                telefono,
                password: hashedPassword,
                empresa_id: empresaId
            },
            
        });
        
        delete newUser['password'];

        //Agregar rol a usuario
        const usuarioRolData = rolesData.map(e => ({
            usuario_id: newUser.id,
            rol_id: e.id
        }));

        const usuarioRol = await prisma.usuarioRol.createMany({
            data: usuarioRolData
        });

        return newUser;

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al crear usuario');
    }
}


const getCajasEstablecimientosByUsuarioId = async ({ usuarioId }) => {

    const usuario = await prisma.usuario.findFirst({
        where: {
            id: usuarioId
        },
        include: {
            empresa: {
                include: {
                    establecimientos: true,
                }
            }
        }
    })

    const establecimientos = usuario.empresa.establecimientos

    const cajas = await prisma.caja.findMany({
        where: {
            establecimiento_id: {
                in: establecimientos.map(el => el.id)
            }
        },
        include: {
            establecimiento: true
        }
    })

    console.log(cajas)

    return cajas

}

module.exports = {
    authenticateUsuario,
    register,
    getCajasEstablecimientosByUsuarioId
}