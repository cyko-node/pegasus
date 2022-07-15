const express  = require('express')
const multer   = require('multer')
const mixpanel = require('mixpanel')
// ------
const pkg = require('./package.json')
const cfg = require('./config.json')
// ------
const dbg = process.argv.at(3) || cfg.log.verbose
const key = process.argv.at(2) || 'test'
// ------
const web = express()
const get = multer()
const mix = mixpanel.init(cfg.mode[key].token)


// #region help:lib (common) ----------------------------------------------- *

const lib = {
  log: {
    pre: `[${pkg.name}]:`,
    out(...x) { console.debug(...x) },
    err(...x) { console.error(...x) },
  }
}

// #endregion
// #region help:nox -------------------------------------------------------- *

const nox = {
  has(o, k) { return Object.prototype.hasOwnProperty.call(o, k) },
  get(o, k, d = null) { return this.has(o, k) ? o[k] : d }
}

// #endregion
// #region help:log -------------------------------------------------------- *

const log = {
  out(...x) { lib.log.out(lib.log.pre, ...x) },
  err(...x) { lib.log.out(lib.log.pre, ...x) },
  bug(...x) { lib.log.err(new Error(string(...x))) },
  dbg(...x) {
    if (cfg.log.verbose) {
      this.err(...x)
    }
  }
}

// #endregion
// #region help:EventData -------------------------------------------------- *

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
    return String(this.#name).length > 1 && Object.keys(this.#data).length > 1
  }
}

// #endregion

// #region main:init ------------------------------------------------------- *

if (nox.has(cfg.mode, key)) {
  log.out(pkg.name, '-', pkg.description, '-', pkg.version)
  log.out('----')
  log.out('mode:', cfg.mode[key].info)
  log.out('prop:', cfg.mode[key].name, `(${cfg.mode[key].token})`)
  log.out('port:', cfg.mode[key].port)
  log.out('----')
} else {
  log.err('no such mode/configuration:', key)
  process.exit(1)
}
// #endregion

// #region http:hook (listen) ---------------------------------------------- *

web.listen(cfg.mode[key].port, () => {
  log.out('listening for incoming data ...')
})

// #endregion
// #region http:hook (post) ------------------------------------------------ *

web.post('/', get.any(), (req, res) => {
  log.out('(http/post) hook!')

  var p = req.body ? JSON.parse(req.body.payload) : null
  var h = req.headers || { 'user-agent': null }

  log.dbg('(http/post) body.payload:', p)

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
    mix.track(e.name, e.data, (err) => {
      if (err) {
        log.bug(err)
      }
    })
  } else {
    log.err('(http/post) event.skip()')
  }
})

// #endregion
// #region http:hook (get) ------------------------------------------------- *

web.get('/', (req, res) => {
  log.out('(http/get)', '...')
  res.send(`${pkg.name} is up and running!`) // browser(html) message for ex.
})

// #endregion
