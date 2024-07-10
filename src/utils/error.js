const { AxiosError } = require('axios');
const { Prisma } = require('@prisma/client');

class ErrorApp extends Error {
    constructor(message, code){
        super(message);
        this.code = code;
    }

    static handleServiceError(error, context, code = 500) {
        if(error instanceof AxiosError){
            const message = error.response && error.response.data && error.response.data.message ? 
            error.response.data.message : error.message;
            throw new ErrorApp(message, error.response.status);
        }
        
        if(error instanceof ErrorApp){
            throw error;
        }
    
        if(error instanceof Error){
            throw new ErrorApp(error.message, code)
        }
    
        throw new ErrorApp(context, code);
    }

    static handleControllerError(error, message = 'Error al procesar la solicitud'){
        if(error instanceof ErrorApp){
            return {
                message: error.message,
                code: error.code
            }
        }

        if(error instanceof Error){
            return {
                message: error.message,
                code: 500
            }
        }

        return {
            message,
            code: 500
        }
    }

}



module.exports = ErrorApp