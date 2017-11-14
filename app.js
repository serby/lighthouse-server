const port = process.env.PORT || 3001
const host = process.env.HOST || 'localhost'

const express = require('express')
const { promisify } = require('util')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const fs = require('fs')
const { join } = require('path')
const { exec } = require('child_process')
const apiKey = '158b7ff5745254e6ae5ad0ac5e56ab2b'
const cachePath = join(__dirname, '.cache')
const mkdirp = require('mkdirp')

mkdirp.sync(cachePath)
const app = express()
app.use(bodyParser.json())

const keyCheck = (req, res, next) => {
  if (req.query.key !== apiKey) return res.sendStatus(403)
  next()
}

const generate = async (url) => {
  if (!url) throw new Error('Missing url')
  const start = Date.now()
  const lighthouseCmd = `${__dirname}/node_modules/.bin/lighthouse --quiet --chrome-flags="--headless" --output-path=stdout ${url}`
  console.log(lighthouseCmd)
  const { stdout, stderr } = await promisify(exec)(lighthouseCmd, { maxBuffer: 1024 * 1024 * 10 })
  if (stderr) console.error(stderr)
  console.log(`URL ${url} complete in ${Date.now() - start}ms`)
  return stdout
}

app.get('/', keyCheck, async (req, res) => {
  try {
    res.send(await generate(req.query.url))
  } catch (e) {
    console.error(e)
    res.status(500).send(e)
  }
})

app.post('/netlify-hook', keyCheck, async (req, res) => {
  if (!req.body['build_id']) return res.status(400).send('Missing build_id')
  if (!req.body['deploy_ssl_url']) return res.status(400).send('Missing deploy_ssl_url')
  try {
    res.set('content-type', 'text/html')
    cache(req.body['build_id'], async () => generate(req.body['deploy_ssl_url']))
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.send(`${url}/cache/${req.body['build_id']}`)
  } catch (e) {
    console.error(e)
    res.status(500).send(e)
  }
})

app.get('/cache/:id', keyCheck, async (req, res) => {
  try {
    res.set('content-type', 'text/html')
    const filename = join(cachePath, req.params.id)
    res.send(await promisify(fs.readFile)(filename))
  } catch (e) {
    console.error(e)
    res.status(500).send(e)
  }
})

const cache = async (id, fn) => {
  const filename = join(cachePath, id)
  try {
    const data = await promisify(fs.readFile)(filename)
    console.log('From cache', id)
    return data
  } catch (e) {
    const data = await fn()
    await promisify(fs.writeFile)(filename, data)
    return data
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on http://${host}:${port}`)
})
