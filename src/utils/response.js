class Response {
    constructor(status, code, data, message){
        this.status = status;
        this.code = code;
        this.data = data;
        this.message = message;
    }
}

module.exports = Response;