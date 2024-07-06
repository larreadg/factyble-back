const ErrorApp = require('./error');
const { AxiosError } = require('axios')

const handleError = (error) => {

    if(error instanceof ErrorApp){
        return error;
    }

    if(error instanceof AxiosError){
        return new ErrorApp(error.message, error.response.status);
    }

    return new ErrorApp('Server Error', 500);
}

module.exports = handleError;