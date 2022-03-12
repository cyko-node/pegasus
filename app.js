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
const dbg = process.argv.at(3) || cfg.log.verbose
const key = process.argv.at(2) || 'test'
const app = {
  web: null,
  get: null,
  mix: null,
}

/* ------------------------------------------------------------------------- */

class EventData {
  #name = null
  #data = {}
  #user = null

  /**
   * Constructs the data using a `source` with a matching `config` structure.
   *
   * @see config.json ( contains the structuring ).
   *
   * @param {object} obj `source` ( payload )
   * @param {object} cfg `config` : structure
   * @param {object} usr `config` : user
   */

  constructor(obj, cfg, usr) {
    if (obj != null && cfg != null && usr != null) {
      // note: mixpanel expects string values

      // event name
      this.#name = String(obj.event)

      // event properties
      for (const key in cfg) {
        if (nox.has(obj, key)) {
          cfg[key].forEach((o) => {
            for (const k in o) {
              if (nox.has(obj[key], k)) {
                this.#data[o[k]] = String(obj[key][k])
              }
            }
          })
        }
      }

      // event user
      this.#user = nox.get(this.#data, usr.key, null)
    } else {
      log.err('@ EventData(obj, cfg, usr) : missing one or more arg ...')
      log.err('> obj:', Boolean(obj))
      log.err('> cfg:', Boolean(cfg))
      log.err('> usr:', Boolean(usr))
    }
  }

  get name() { return this.#name }
  get data() { return this.#data }
  get user() { return this.#user }

  complete() {
    return String(this.name).length > 1 && Object.keys(this.data).length > 1
  }
}

/* -----+------------------------------------------------------------------- +
 | CODE : INIT
 +------+-------------------- */

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
 | CODE : HTTP HOOK
 +------+-------------------- */

app.web.listen(cfg.mode[key].port, () => {
  log.out('listening for incoming data ...')
})

/* -----+------------------------------------------------------------------- +
 | CODE : HTTP POST
 +------+-------------------- */

app.web.post('/', app.get.any(), (req, res) => {
  log.out('(http/post) hook!')

  var p = req.body ? JSON.parse(req.body.payload) : null
  var h = req.headers || { 'user-agent': null }

  if (dbg) {
    log.out('(http/post) body.payload:', p)
  }

  log.out('(http/post) headers:', h)
  log.out('(http/post) headers[user-agent]:', h['user-agent'])
  log.out('>---------')

  var e = new EventData(p,
    cfg.data.structure,
    cfg.data.user
  )

  log.out('(http/post) event.name:', e.name)
  log.out('(http/post) event.user:', e.user)
  log.out('(http/post) event.data:', e.data)

  if (e.complete()) {
    log.out('(http/post) event.send() > mixpanel.com')
    app.mix.track(e.name, e.data, (err) => {
      if (err) {
        log.bug(err)
      }
    })
  } else {
    log.err('(http/post) event.skip()')
  }
})

/* -----+------------------------------------------------------------------- +
 | CODE : HTTP GET
 +------+-------------------- */

app.web.get('/', (req, res) => {
  log.out('(http/get)', '...')
  res.send(`${pkg.name} is up and running!`)
})
