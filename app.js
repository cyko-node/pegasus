const express  = require('express')
const multer   = require('multer')
const mixpanel = require('mixpanel')
// ------
const nox = require('nox')
const era = require('era')
const log = require('log')
// ------
const pkg = require('./package.json')
const cfg = require('./config.json')
// ------
const dbg = cfg.log.verbose
const key = process.argv.at(2) || 'test'
const app = {
  web: null,
  get: null,
  mix: null,
}

/* ------------------------------------------------------------------------- */

class EventData {
  #okay = false
  #name = null
  #data = {}
  #user = null

  /**
   * Constructs the data using a `source` with a matching `config` structure.
   *
   * @see config.json ( contains the structuring )
   *
   * @param {object} obj `source` ( payload )
   * @param {object} cfg `config` : structure
   * @param {object} usr `config` : user
   */

  constructor(obj, cfg, usr) {
    if (obj != null && cfg != null && usr != null) {
      // event name
      this.#name = obj.event

      // event properties
      for (const key in cfg) {
        if (nox.has(obj, key)) {
          cfg[key].forEach((o) => {
            for (const k in o) {
              if (nox.has(obj[key], k)) {
                // define property (mixpanel expect strings)
                this.#data[o[k]] = String(obj[key][k])
              }
            }
          })
        }
      }

      // event user
      if (nox.has(this.#data, usr.key)) {
        this.#user = this.#data[usr.key] // [Account]
        this.#data[usr.property] = this.#user // [distinct_id] = [Account]
      }

      // event status
      this.#okay = Object.keys(this.#data).length > 1 && this.#name != null
    } else {
      log.err('@ EventData(obj, cfg, usr) : missing one or more arg...')
      log.err('> obj:', Boolean(obj))
      log.err('> cfg:', Boolean(cfg))
      log.err('> usr:', Boolean(usr))
      this.#okay = false
    }
  }

  get okay() { return this.#okay }
  get name() { return this.#name }
  get data() { return this.#data }
  get user() { return this.#user }
}

/* -----+------------------------------------------------------------------- +
 | CODE : INIT
 +------+---------- */

era.config(cfg.era.locale)
log.config({
  header: {
    middle: era.time.string
  }
})

if (nox.has(cfg.mode, key)) {
  log.out(pkg.name, '-', pkg.description, '-', pkg.version)
  log.out('----')
  log.out('mode:', cfg.mode[key].info)
  log.out('prop:', cfg.mode[key].name, `(${cfg.mode[key].token})`)
  log.out('port:', cfg.mode[key].port)
  log.out('----')
  log.out('init: express')
  app.web = express()
  log.out('init: multer')
  app.get = multer()
  log.out('init: mixpanel')
  app.mix = mixpanel.init(cfg.mode[key].token)
  log.out('----')
} else {
  log.err('no such mode/configuration:', key)
  process.exit(1)
}

/* -----+------------------------------------------------------------------- +
 | CODE : HTTP HOOKER
 +------+---------- */

app.web.listen(cfg.mode[key].port, () => {
  log.out('listening for incoming data ...')
})

/* -----+------------------------------------------------------------------- +
 | CODE : HTTP POST
 +------+---------- */

app.web.post('/', app.get.any(), (req, res) => {
  log.out('HTTP /POST')
  log.out('----------')

  var p = req.body ? JSON.parse(req.body.payload) : null
  var h = req.headers || { 'user-agent': null }

  if (dbg) {
    log.out('post < body.payload:', p)
  }

  log.out('post < headers:', h)
  log.out('post < headers[user-agent]:', h['user-agent'])
  log.out('----------')

  var e = new EventData(p,
    cfg.data.structure,
    cfg.data.user
  )


  log.out('post > event.name:', e.name)
  log.out('post > event.user:', e.user)
  log.out('post > event.data:', e.data)

  if (e.okay) {
    log.out('send: mixpanel.com')
    app.mix.track(e.name, e.data, (err) => {
      if (err) {
        log.bug(err)
      }
    })
  } else {
    log.err('skip: missing event data!')
  }
})

/* -----+------------------------------------------------------------------- +
 | CODE : HTTP GET
 +------+---------- */

app.web.get('/', (req, res) => {
  log.out('HTTP /GET')
  res.send(`${pkg.name} is up and running!`)
})
