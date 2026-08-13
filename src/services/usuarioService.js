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
const authenticateUsuario = async ({ usuario, password, captcha, source } = {}) => {

    try {

        const bypassCaptcha = source === 'api'

        if (!bypassCaptcha) {
            if (!captcha) {
                throw new ErrorApp('Captcha inválida o expirada', 401);
            }

            const captchaCheck = await prisma.captcha.findFirst({
                where: {
                captcha,
                fecha_expiracion: { gt: dayjs().toDate() }
                }
            });

            if (!captchaCheck) {
                throw new ErrorApp('Captcha inválida o expirada', 401);
            }

            await prisma.captcha.deleteMany({ where: { captcha } });
        }

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
            empresaNombre: user.empresa ? user.empresa.nombre_empresa : null,
            empresaRuc: user.empresa ? user.empresa.ruc : null,
            roles: user.roles.map(r => r.rol.nombre)
        }

        const token = generateToken(tokenPayload);

        return token;
    
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al autenticar usuario');
    }

}

/**
 * Autentica al usuario y genera (o regenera) un JWT sin expiración que se persiste
 * en usuario.api_key. Al regenerar, el api key anterior queda invalidado porque el
 * middleware exige que el x-api-key coincida con el valor guardado.
 * @param {String} usuario
 * @param {String} password
 * @returns {Promise<String>} el api key (JWT sin expiración)
 */
const generarApiKey = async ({ usuario, password } = {}) => {

    try {

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
            empresaNombre: user.empresa ? user.empresa.nombre_empresa : null,
            empresaRuc: user.empresa ? user.empresa.ruc : null,
            roles: user.roles.map(r => r.rol.nombre)
        }

        const apiKey = generateToken(tokenPayload, { sinExpiracion: true });

        await prisma.usuario.update({
            where: { id: user.id },
            data: { api_key: apiKey }
        });

        return apiKey;

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al generar api key');
    }

}

/**
 * Revoca el api key del usuario seteando usuario.api_key a null. Como el middleware exige
 * que el x-api-key coincida con el valor guardado, el api key anterior deja de ser válido.
 * @param {Number} usuarioId
 */
const revocarApiKey = async ({ usuarioId } = {}) => {

    try {

        await prisma.usuario.update({
            where: { id: usuarioId },
            data: { api_key: null }
        });

        return { revocada: true };

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al revocar api key');
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

    return cajas

}

module.exports = {
    authenticateUsuario,
    generarApiKey,
    revocarApiKey,
    register,
    getCajasEstablecimientosByUsuarioId
}