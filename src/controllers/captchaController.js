const { validationResult } = require('express-validator')
const Response = require('../utils/response')
const ErrorApp = require('../utils/error')
const { generarCaptcha } = require('../services/captchaService')


const generarCaptchaController = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, null, errors.array()))

    const { ip } = req
    const captcha = await generarCaptcha({ ip })
    res.type('svg')
    res.status(200).send(captcha)
  } catch (e) {
    if (e instanceof ErrorApp) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

module.exports = {
  generarCaptchaController
}